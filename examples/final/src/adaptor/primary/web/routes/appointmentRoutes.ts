import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import {
  AppointmentId,
  type AppointmentId as AppointmentIdType,
} from "../../../../domain/appointment/appointmentId.js";
import { PaymentAmount } from "../../../../domain/appointment/paymentAmount.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import { Sensitive } from "../../../../domain/shared/sensitive.js";
import type { BookAppointmentUseCase } from "../../../../useCase/bookAppointmentUseCase.js";
import type { CancelAppointmentUseCase } from "../../../../useCase/cancelAppointmentUseCase.js";
import type { CheckInAppointmentUseCase } from "../../../../useCase/checkInAppointmentUseCase.js";
import type { GetAppointmentUseCase } from "../../../../useCase/getAppointmentUseCase.js";
import type {
  AppointmentView,
  ListAppointmentsUseCase,
} from "../../../../useCase/listAppointmentsUseCase.js";
import type { ListOwnersUseCase } from "../../../../useCase/listOwnersUseCase.js";
import type { ListPetsUseCase } from "../../../../useCase/listPetsUseCase.js";
import type { ListUsersUseCase } from "../../../../useCase/listUsersUseCase.js";
import type { RecordExamResultUseCase } from "../../../../useCase/recordExamResultUseCase.js";
import type { RecordPaymentUseCase } from "../../../../useCase/recordPaymentUseCase.js";
import type { StartExaminationUseCase } from "../../../../useCase/startExaminationUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";
import type {
  AuthenticatedActor,
  FieldErrors,
  WebEnvironment,
} from "../pageProps.js";

const BookingSchema = z.object({
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().trim().min(1).max(500).transform(Sensitive.of),
});
const StartExaminationSchema = z.object({
  veterinarianId: VeterinarianId.schema.optional(),
});
const ExamResultSchema = z.object({
  petId: PetId.schema,
  collectedAt: Timestamp.schema,
  item: z.string().trim().min(1).max(2_000).transform(Sensitive.of),
  needsFollowUp: z.preprocess(
    (value) =>
      value === undefined || value === "0" || value === "false" || value === false
        ? false
        : value === "1" || value === "true" || value === "on" || value === true
          ? true
          : value,
    z.boolean(),
  ),
});
const PaymentSchema = z.object({
  diagnosis: z.string().trim().min(1).max(500).transform(Sensitive.of),
  treatment: z.string().trim().min(1).max(500).transform(Sensitive.of),
  amount: z.coerce.number().pipe(PaymentAmount.schema),
});
const CancelSchema = z.object({
  reason: z.string().trim().min(1).max(500).transform(Sensitive.of),
});
const AppointmentDetailErrorSchema = z.enum([
  "invalid-state",
  "pet-mismatch",
  "appointment-conflict",
]);

export type AppointmentActions = Readonly<{
  checkIn: boolean;
  cancel: boolean;
  startExamination: boolean;
  recordExamResult: boolean;
  recordPayment: boolean;
}>;
export type AppointmentOwnerOption = Readonly<{
  ownerId: z.infer<typeof OwnerId.schema>;
  name: string;
}>;
export type AppointmentPetOption = Readonly<{
  petId: z.infer<typeof PetId.schema>;
  ownerId: z.infer<typeof OwnerId.schema>;
  name: string;
}>;
export type AppointmentVeterinarianOption = Readonly<{
  veterinarianId: z.infer<typeof VeterinarianId.schema>;
  name: string;
}>;

type AppointmentRouteDependencies = Readonly<{
  listAppointments: ListAppointmentsUseCase;
  getAppointment: GetAppointmentUseCase;
  bookAppointment: BookAppointmentUseCase;
  checkInAppointment: CheckInAppointmentUseCase;
  startExamination: StartExaminationUseCase;
  recordExamResult: RecordExamResultUseCase;
  recordPayment: RecordPaymentUseCase;
  cancelAppointment: CancelAppointmentUseCase;
  listOwners: ListOwnersUseCase;
  listPets: ListPetsUseCase;
  listUsers: ListUsersUseCase;
}>;

const parseBody = <TOutput, TInput>(
  context: Context<WebEnvironment>,
  schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>,
) =>
  ResultAsync.fromPromise(
    context.req.parseBody(),
    (): ValidationError => ({
      kind: "ValidationError",
      errors: { form: "入力内容を確認してください" },
    }),
  ).andThen((body) => {
    const parsed = schema.safeParse(body);
    return parsed.success
      ? ok(parsed.data)
      : err({
          kind: "ValidationError",
          errors: issuesToFieldErrors(parsed.error.issues),
        } as const satisfies ValidationError);
  });

const parseAppointmentId = (
  context: Context<WebEnvironment>,
  raw: string,
): Result<AppointmentIdType, Response> => {
  const parsed = AppointmentId.schema.safeParse(raw);
  return parsed.success
    ? ok(parsed.data)
    : err(respondToUseCaseError(context, { kind: "NotFound" }));
};

const requireActor = (
  context: Context<WebEnvironment>,
): Result<AuthenticatedActor, Response> => {
  const actor = context.get("actor");
  return actor === undefined
    ? err(respondToUseCaseError(context, { kind: "Unauthenticated" }))
    : ok(actor);
};
const requireClinicManager = (
  context: Context<WebEnvironment>,
): Result<AuthenticatedActor, Response> =>
  requireActor(context).andThen((actor) =>
    actor.user.kind === "Admin" || actor.user.kind === "Receptionist"
      ? ok(actor)
      : err(respondToUseCaseError(context, { kind: "Unauthorized" })),
  );
const requireExaminer = (
  context: Context<WebEnvironment>,
): Result<AuthenticatedActor, Response> =>
  requireActor(context).andThen((actor) =>
    actor.user.kind === "Admin" || actor.user.kind === "Veterinarian"
      ? ok(actor)
      : err(respondToUseCaseError(context, { kind: "Unauthorized" })),
  );

const actionsFor = (
  actor: AuthenticatedActor,
  appointment: AppointmentView,
): AppointmentActions => {
  const manager =
    actor.user.kind === "Admin" || actor.user.kind === "Receptionist";
  const assignedExaminer =
    actor.user.kind === "Admin" ||
    (actor.user.kind === "Veterinarian" &&
      appointment.kind === "InExamination" &&
      actor.user.veterinarianId === appointment.veterinarianId);
  return {
    checkIn: manager && appointment.kind === "Scheduled",
    cancel:
      manager &&
      (appointment.kind === "Scheduled" || appointment.kind === "CheckedIn"),
    startExamination:
      (actor.user.kind === "Admin" || actor.user.kind === "Veterinarian") &&
      appointment.kind === "CheckedIn",
    recordExamResult:
      appointment.kind === "InExamination" && assignedExaminer,
    recordPayment: manager && appointment.kind === "InExamination",
  };
};

const detailErrors = (raw: string | undefined): FieldErrors => {
  const parsed = AppointmentDetailErrorSchema.safeParse(raw);
  if (!parsed.success) return {};
  const code = parsed.data;
  switch (code) {
    case "invalid-state":
      return {
        form:
          "現在の予約状態ではこの操作を実行できません。画面を更新して状態を確認してください。",
      };
    case "pet-mismatch":
      return {
        form:
          "予約と診察結果のペットが一致しません。画面を更新して確認してください。",
      };
    case "appointment-conflict":
      return {
        form: "予約を更新できませんでした。最新の状態を確認してください。",
      };
    default:
      return assertNever(code);
  }
};

const renderAppointment = async (
  context: Context<WebEnvironment>,
  dependencies: AppointmentRouteDependencies,
  appointmentId: AppointmentIdType,
  errors: FieldErrors = {},
): Promise<Response> => {
  const actor = requireActor(context);
  if (actor.isErr()) return actor.error;
  let veterinarianOptions: readonly AppointmentVeterinarianOption[] = [];
  if (actor.value.user.kind === "Admin") {
    const veterinarians = await dependencies.listUsers.run({
      actorUserId: actor.value.user.userId,
    });
    if (veterinarians.isErr()) {
      switch (veterinarians.error.kind) {
        case "Unauthorized":
          return respondToUseCaseError(context, { kind: "Unauthorized" });
        case "RepositoryError":
          return respondToUseCaseError(context, { kind: "RepositoryError" });
        default:
          return assertNever(veterinarians.error);
      }
    }
    veterinarianOptions = veterinarians.value.users
      .filter((user) => user.kind === "Veterinarian")
      .flatMap((user) =>
        user.veterinarianId === undefined
          ? []
          : [{ veterinarianId: user.veterinarianId, name: user.name.unwrap() }],
      );
  }
  return dependencies.getAppointment
    .run({ actorUserId: actor.value.user.userId, appointmentId })
    .match(
      ({ appointment }) =>
        context.render(
          "Appointments/Show",
          withSharedProps(context, {
            appointment,
            actions: actionsFor(actor.value, appointment),
            veterinarianId:
              actor.value.user.kind === "Veterinarian"
                ? actor.value.user.veterinarianId
                : null,
            veterinarians: veterinarianOptions,
            errors,
          }),
        ),
      (error) => {
        switch (error.kind) {
          case "Unauthorized":
            return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "AppointmentNotFound":
            return respondToUseCaseError(context, { kind: "NotFound" });
          case "RepositoryError":
            return respondToUseCaseError(context, { kind: "RepositoryError" });
          default:
            return assertNever(error);
        }
      },
    );
};

const loadBookingOptions = async (
  context: Context<WebEnvironment>,
  dependencies: AppointmentRouteDependencies,
): Promise<
  Result<
    Readonly<{
      owners: readonly AppointmentOwnerOption[];
      pets: readonly AppointmentPetOption[];
    }>,
    Response
  >
> => {
  const actor = requireClinicManager(context);
  if (actor.isErr()) return err(actor.error);
  const owners = await dependencies.listOwners.run({
    actorUserId: actor.value.user.userId,
  });
  if (owners.isErr()) {
    switch (owners.error.kind) {
      case "Unauthorized":
        return err(respondToUseCaseError(context, { kind: "Unauthorized" }));
      case "RepositoryError":
        return err(respondToUseCaseError(context, { kind: "RepositoryError" }));
      default:
        return assertNever(owners.error);
    }
  }
  const pets = await dependencies.listPets.run({
    actorUserId: actor.value.user.userId,
  });
  return pets
    .map(({ pets: values }) => ({
      owners: owners.value.owners.map((owner) => ({
        ownerId: owner.ownerId,
        name: owner.name,
      })),
      pets: values.map((pet) => ({
        petId: pet.petId,
        ownerId: pet.ownerId,
        name: pet.name,
      })),
    }))
    .mapErr((error) => {
      switch (error.kind) {
        case "Unauthorized":
          return respondToUseCaseError(context, { kind: "Unauthorized" });
        case "RepositoryError":
          return respondToUseCaseError(context, { kind: "RepositoryError" });
        default:
          return assertNever(error);
      }
    });
};

const renderBooking = async (
  context: Context<WebEnvironment>,
  dependencies: AppointmentRouteDependencies,
  errors: FieldErrors = {},
): Promise<Response> => {
  const options = await loadBookingOptions(context, dependencies);
  return options.match(
    (values) =>
      context.render(
        "Appointments/New",
        withSharedProps(context, { ...values, errors }),
      ),
    (response) => response,
  );
};

const detailUrl = (appointmentId: AppointmentIdType): string =>
  `/appointments/${appointmentId}`;
const invalidState = (
  context: Context<WebEnvironment>,
  appointmentId: AppointmentIdType,
): Response => context.redirect(`${detailUrl(appointmentId)}?error=invalid-state`, 303);
const repositoryFailure = (context: Context<WebEnvironment>): Response =>
  respondToUseCaseError(context, { kind: "RepositoryError" });

export const registerAppointmentRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: AppointmentRouteDependencies,
): void => {
  app.get("/appointments", async (context) => {
    const actor = requireActor(context);
    if (actor.isErr()) return actor.error;
    return dependencies.listAppointments
      .run({ actorUserId: actor.value.user.userId })
      .match(
        ({ appointments }) =>
          context.render(
            "Appointments/Index",
            withSharedProps(context, { appointments }),
          ),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.get("/appointments/new", (context) =>
    renderBooking(context, dependencies),
  );

  app.post("/appointments", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const parsed = await parseBody(context, BookingSchema);
    if (parsed.isErr()) {
      return renderBooking(context, dependencies, parsed.error.errors);
    }
    return dependencies.bookAppointment
      .run({ actorUserId: actor.value.user.userId, ...parsed.value })
      .match(
        ({ appointment }) => context.redirect(detailUrl(appointment.appointmentId), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "OwnerNotFound":
              return renderBooking(context, dependencies, {
                ownerId: "選択した飼い主が見つかりません。",
              });
            case "PetNotFound":
              return renderBooking(context, dependencies, {
                petId: "選択したペットが見つかりません。",
              });
            case "PetOwnerMismatch":
              return renderBooking(context, dependencies, {
                petId: "選択した飼い主に登録されたペットを選んでください。",
              });
            case "AppointmentConflict":
              return context.redirect(`${detailUrl(error.appointmentId)}?error=appointment-conflict`, 303);
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.get("/appointments/:appointmentId", (context) => {
    const parsed = parseAppointmentId(context, context.req.param("appointmentId"));
    return parsed.match(
      (appointmentId) =>
        renderAppointment(
          context,
          dependencies,
          appointmentId,
          detailErrors(context.req.query("error")),
        ),
      (response) => response,
    );
  });

  app.post("/appointments/:appointmentId/check-in", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    return dependencies.checkInAppointment
      .run({ actorUserId: actor.value.user.userId, appointmentId: appointmentId.value })
      .match(
        () => context.redirect(detailUrl(appointmentId.value), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "AppointmentNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "InvalidAppointmentState":
              return invalidState(context, appointmentId.value);
            case "AppointmentConflict":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/appointments/:appointmentId/start-examination", async (context) => {
    const actor = requireExaminer(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, StartExaminationSchema);
    if (parsed.isErr()) {
      return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    }
    const veterinarianId =
      actor.value.user.kind === "Veterinarian"
        ? actor.value.user.veterinarianId
        : parsed.value.veterinarianId;
    if (veterinarianId === undefined) {
      return renderAppointment(context, dependencies, appointmentId.value, {
        veterinarianId: "担当する獣医師 ID を入力してください。",
      });
    }
    return dependencies.startExamination
      .run({ actorUserId: actor.value.user.userId, appointmentId: appointmentId.value, veterinarianId })
      .match(
        () => context.redirect(detailUrl(appointmentId.value), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "AppointmentNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "InvalidAppointmentState":
              return invalidState(context, appointmentId.value);
            case "AppointmentConflict":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/appointments/:appointmentId/exam-results", async (context) => {
    const actor = requireExaminer(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, ExamResultSchema);
    if (parsed.isErr()) {
      return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    }
    return dependencies.recordExamResult
      .run({
        actorUserId: actor.value.user.userId,
        appointmentId: appointmentId.value,
        petId: parsed.value.petId,
        collectedAt: parsed.value.collectedAt,
        items: [parsed.value.item],
        needsFollowUp: parsed.value.needsFollowUp,
      })
      .match(
        () => context.redirect(detailUrl(appointmentId.value), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "AppointmentNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "InvalidAppointmentState":
              return invalidState(context, appointmentId.value);
            case "ExamResultPetMismatch":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=pet-mismatch`, 303);
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/appointments/:appointmentId/payment", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, PaymentSchema);
    if (parsed.isErr()) {
      return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    }
    return dependencies.recordPayment
      .run({ actorUserId: actor.value.user.userId, appointmentId: appointmentId.value, ...parsed.value })
      .match(
        () => context.redirect(detailUrl(appointmentId.value), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "AppointmentNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "InvalidAppointmentState":
              return invalidState(context, appointmentId.value);
            case "AppointmentConflict":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/appointments/:appointmentId/cancel", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, CancelSchema);
    if (parsed.isErr()) {
      return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    }
    return dependencies.cancelAppointment
      .run({ actorUserId: actor.value.user.userId, appointmentId: appointmentId.value, reason: parsed.value.reason })
      .match(
        () => context.redirect(detailUrl(appointmentId.value), 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "AppointmentNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "InvalidAppointmentState":
              return invalidState(context, appointmentId.value);
            case "AppointmentConflict":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return repositoryFailure(context);
            default:
              return assertNever(error);
          }
        },
      );
  });
};
