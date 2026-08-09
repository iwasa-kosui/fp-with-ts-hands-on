import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import {
  AppointmentId,
  type AppointmentId as AppointmentIdType,
} from "../../../../domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../../../domain/appointment/appointmentReason.js";
import { AppointmentDuration } from "../../../../domain/appointment/appointmentDuration.js";
import { AppointmentVersion } from "../../../../domain/appointment/appointmentVersion.js";
import { CancellationReason } from "../../../../domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../../../domain/appointment/diagnosis.js";
import { PaymentAmount } from "../../../../domain/appointment/paymentAmount.js";
import { ReceptionNote } from "../../../../domain/appointment/receptionNote.js";
import { ServiceCode } from "../../../../domain/appointment/serviceCode.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { Treatment } from "../../../../domain/appointment/treatment.js";
import { ExamResultItem } from "../../../../domain/examResult/examResultItem.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import type { BookAppointmentUseCase } from "../../../../useCase/bookAppointmentUseCase.js";
import type { CancelAppointmentUseCase } from "../../../../useCase/cancelAppointmentUseCase.js";
import type { CheckInAppointmentUseCase } from "../../../../useCase/checkInAppointmentUseCase.js";
import type { GetAppointmentUseCase } from "../../../../useCase/getAppointmentUseCase.js";
import type { AppointmentView } from "../../../../useCase/listAppointmentsUseCase.js";
import type { ListOwnersUseCase } from "../../../../useCase/listOwnersUseCase.js";
import type { ListPetsUseCase } from "../../../../useCase/listPetsUseCase.js";
import type { ListVeterinariansUseCase } from "../../../../useCase/listVeterinariansUseCase.js";
import type { UpdateAppointmentUseCase } from "../../../../useCase/updateAppointmentUseCase.js";
import type { ReassignAppointmentVeterinarianUseCase } from "../../../../useCase/reassignAppointmentVeterinarianUseCase.js";
import type { RecordExamResultUseCase } from "../../../../useCase/recordExamResultUseCase.js";
import type { RecordPaymentUseCase } from "../../../../useCase/recordPaymentUseCase.js";
import type { StartExaminationUseCase } from "../../../../useCase/startExaminationUseCase.js";
import type { UpdateReceptionNoteUseCase } from "../../../../useCase/updateReceptionNoteUseCase.js";
import type { ReceiveAppointmentDepositUseCase } from "../../../../useCase/receiveAppointmentDepositUseCase.js";
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

const AppointmentInputSchema = z.object({
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  scheduledAt: Timestamp.schema,
  serviceCode: ServiceCode.schema,
  durationMinutes: z.coerce.number().pipe(AppointmentDuration.schema),
  assignedVeterinarianId: z.preprocess(
    (value) => value === "" ? null : value,
    VeterinarianId.schema.nullable(),
  ),
  reason: AppointmentReason.schema,
});
const UpdateAppointmentSchema = AppointmentInputSchema.extend({
  expectedVersion: z.coerce.number().pipe(AppointmentVersion.schema),
});
const ReassignVeterinarianSchema = z.object({
  expectedVersion: z.coerce.number().pipe(AppointmentVersion.schema),
  assignedVeterinarianId: z.preprocess(
    (value) => value === "" ? null : value,
    VeterinarianId.schema.nullable(),
  ),
});
const VersionedMutationShape = {
  expectedVersion: z.coerce.number().pipe(AppointmentVersion.schema),
} as const;
const CheckInSchema = z.object(VersionedMutationShape);
const ReceptionNoteSchema = z.object({
  ...VersionedMutationShape,
  receptionNote: z.preprocess(
    (value) => value === "" ? null : value,
    ReceptionNote.schema.nullable(),
  ),
});
const DepositSchema = z.object({
  ...VersionedMutationShape,
  depositAmount: z.coerce.number().pipe(PaymentAmount.schema),
});
const StartExaminationSchema = z.object({
  ...VersionedMutationShape,
  veterinarianId: VeterinarianId.schema.optional(),
});
const ExamResultSchema = z.object({
  ...VersionedMutationShape,
  petId: PetId.schema,
  collectedAt: Timestamp.schema,
  item: ExamResultItem.schema,
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
  ...VersionedMutationShape,
  diagnosis: Diagnosis.schema,
  treatment: Treatment.schema,
  finalAmount: z.coerce.number().pipe(PaymentAmount.schema),
});
const CancelSchema = z.object({
  ...VersionedMutationShape,
  reason: CancellationReason.schema,
});
const AppointmentDetailErrorSchema = z.enum([
  "invalid-state",
  "pet-mismatch",
  "appointment-conflict",
  "schedule-conflict",
  "prepaid-fields",
  "deposit-not-allowed",
  "deposit-already-received",
  "veterinarian-required",
  "veterinarian-mismatch",
]);
const deletedLabel = "削除済み";

type AppointmentPageViewFor<T extends AppointmentView> = Readonly<
  Omit<
    T,
    | "ownerName"
    | "petName"
    | "veterinarianName"
    | "assignedVeterinarianName"
    | "visitReason"
    | "receptionNote"
    | "diagnosis"
    | "treatment"
  > & {
    ownerName: string;
    petName: string;
    assignedVeterinarianName: string;
    visitReason: string;
    receptionNote: string | null;
  } & (T extends { veterinarianName: unknown }
      ? { veterinarianName: string }
      : Readonly<Record<never, never>>) &
    (T extends { diagnosis: unknown; treatment: unknown }
      ? { diagnosis: string; treatment: string }
      : Readonly<Record<never, never>>)
>;
export type AppointmentPageView = AppointmentView extends infer T
  ? T extends AppointmentView
    ? AppointmentPageViewFor<T>
    : never
  : never;

export const toAppointmentPageView = (
  appointment: AppointmentView,
  discloseSensitive = false,
): AppointmentPageView => {
  const base = {
    ownerName: appointment.ownerName?.unwrap() ?? deletedLabel,
    petName: appointment.petName?.unwrap() ?? deletedLabel,
    assignedVeterinarianName:
      appointment.assignedVeterinarianId === null
        ? "未定"
        : appointment.assignedVeterinarianName?.unwrap() ?? deletedLabel,
    visitReason: discloseSensitive ? appointment.visitReason.unwrap() : "非表示",
    receptionNote: discloseSensitive
      ? appointment.receptionNote?.unwrap() ?? null
      : null,
  } as const;
  switch (appointment.kind) {
    case "Scheduled":
    case "CheckedIn":
    case "Canceled":
      return { ...appointment, ...base };
    case "InExamination":
    case "AwaitingPayment":
      return {
        ...appointment,
        ...base,
        veterinarianName:
          appointment.veterinarianName?.unwrap() ?? deletedLabel,
      };
    case "Paid":
      return {
        ...appointment,
        ...base,
        veterinarianName:
          appointment.veterinarianName?.unwrap() ?? deletedLabel,
        diagnosis: discloseSensitive ? appointment.diagnosis.unwrap() : "非表示",
        treatment: discloseSensitive ? appointment.treatment.unwrap() : "非表示",
      };
    default:
      return assertNever(appointment);
  }
};

export type AppointmentActions = Readonly<{
  edit: boolean;
  checkIn: boolean;
  reassignVeterinarian: boolean;
  updateReceptionNote: boolean;
  receiveDeposit: boolean;
  startExamination: boolean;
  recordExamResult: boolean;
  settle: boolean;
  cancel: boolean;
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
  getAppointment: GetAppointmentUseCase;
  bookAppointment: BookAppointmentUseCase;
  checkInAppointment: CheckInAppointmentUseCase;
  startExamination: StartExaminationUseCase;
  recordExamResult: RecordExamResultUseCase;
  recordPayment: RecordPaymentUseCase;
  cancelAppointment: CancelAppointmentUseCase;
  listOwners: ListOwnersUseCase;
  listPets: ListPetsUseCase;
  listVeterinarians: ListVeterinariansUseCase;
  updateAppointment: UpdateAppointmentUseCase;
  reassignAppointmentVeterinarian: ReassignAppointmentVeterinarianUseCase;
  updateReceptionNote: UpdateReceptionNoteUseCase;
  receiveAppointmentDeposit: ReceiveAppointmentDepositUseCase;
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
  const active =
    appointment.kind !== "Paid" && appointment.kind !== "Canceled";
  const depositEligible =
    manager &&
    appointment.serviceCode === "Vaccination" &&
    (appointment.kind === "Scheduled" || appointment.kind === "CheckedIn") &&
    appointment.settlement.kind === "NoPayment";
  const canStart =
    appointment.kind === "CheckedIn" &&
    (actor.user.kind === "Admin" ||
      (actor.user.kind === "Veterinarian" &&
        (appointment.assignedVeterinarianId === null ||
          appointment.assignedVeterinarianId === actor.user.veterinarianId)));
  return {
    edit: manager && appointment.kind === "Scheduled",
    checkIn: manager && appointment.kind === "Scheduled",
    reassignVeterinarian:
      manager &&
      (appointment.kind === "Scheduled" || appointment.kind === "CheckedIn"),
    updateReceptionNote: manager && active,
    receiveDeposit: depositEligible,
    startExamination: canStart,
    recordExamResult:
      appointment.kind === "InExamination" && assignedExaminer,
    settle: manager && appointment.kind === "AwaitingPayment",
    cancel:
      manager &&
      (appointment.kind === "Scheduled" || appointment.kind === "CheckedIn"),
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
        form: "別の端末で予約が更新されました。最新の内容を確認してください。",
      };
    case "schedule-conflict":
      return { form: "選択した時間帯には、この獣医師の別の予約があります。" };
    case "prepaid-fields":
      return { form: "前受金の登録後は、ペットと診療メニューを変更できません。" };
    case "deposit-not-allowed":
      return { form: "事前会計は予防接種の予約だけで利用できます。" };
    case "deposit-already-received":
      return { form: "この予約の前受金はすでに登録されています。" };
    case "veterinarian-required":
      return { veterinarianId: "担当獣医師を選択してください。" };
    case "veterinarian-mismatch":
      return { form: "この予約を診察開始できるのは、担当獣医師または管理者です。" };
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
  if (actor.value.user.kind === "Admin" || actor.value.user.kind === "Receptionist") {
    const veterinarians = await dependencies.listVeterinarians.run({
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
    veterinarianOptions = veterinarians.value.veterinarians.map((veterinarian) => ({
      veterinarianId: veterinarian.veterinarianId,
      name: veterinarian.name.unwrap(),
    }));
  }
  return dependencies.getAppointment
    .run({ actorUserId: actor.value.user.userId, appointmentId })
    .match(
      ({ appointment }) =>
        context.render(
          "Appointments/Show",
          withSharedProps(context, {
            appointment: toAppointmentPageView(appointment, true),
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
      veterinarians: readonly AppointmentVeterinarianOption[];
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
  const veterinarians = await dependencies.listVeterinarians.run({
    actorUserId: actor.value.user.userId,
  });
  if (veterinarians.isErr()) {
    return err(respondToUseCaseError(context, {
      kind: veterinarians.error.kind === "Unauthorized" ? "Unauthorized" : "RepositoryError",
    }));
  }
  return pets
    .map(({ pets: values }) => ({
      owners: owners.value.owners.map((owner) => ({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
      })),
      pets: values.map((pet) => ({
        petId: pet.petId,
        ownerId: pet.ownerId,
        name: pet.name.unwrap(),
      })),
      veterinarians: veterinarians.value.veterinarians.map((veterinarian) => ({
        veterinarianId: veterinarian.veterinarianId,
        name: veterinarian.name.unwrap(),
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

const renderEdit = async (
  context: Context<WebEnvironment>,
  dependencies: AppointmentRouteDependencies,
  appointmentId: AppointmentIdType,
  errors: FieldErrors = {},
): Promise<Response> => {
  const actor = requireClinicManager(context);
  if (actor.isErr()) return actor.error;
  const appointment = await dependencies.getAppointment.run({
    actorUserId: actor.value.user.userId,
    appointmentId,
  });
  if (appointment.isErr()) {
    switch (appointment.error.kind) {
      case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
      case "AppointmentNotFound": return respondToUseCaseError(context, { kind: "NotFound" });
      case "RepositoryError": return repositoryFailure(context);
      default: return assertNever(appointment.error);
    }
  }
  if (appointment.value.appointment.kind !== "Scheduled") {
    return invalidState(context, appointmentId);
  }
  const options = await loadBookingOptions(context, dependencies);
  if (options.isErr()) return options.error;
  const value = appointment.value.appointment;
  return context.render("Appointments/Edit", withSharedProps(context, {
    ...options.value,
    appointment: {
      appointmentId: value.appointmentId,
      ownerId: value.ownerId,
      petId: value.petId,
      scheduledAt: value.scheduledAt,
      durationMinutes: value.durationMinutes,
      serviceCode: value.serviceCode,
      assignedVeterinarianId: value.assignedVeterinarianId,
      visitReason: value.visitReason.unwrap(),
      version: value.version,
      immutablePetAndService: value.settlement.kind === "DepositReceived",
    },
    errors,
  }));
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
  app.get("/appointments/new", (context) =>
    renderBooking(context, dependencies),
  );

  app.post("/appointments", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const parsed = await parseBody(context, AppointmentInputSchema);
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
            case "VeterinarianNotFound":
              return renderBooking(context, dependencies, {
                assignedVeterinarianId: "選択した担当獣医師が見つかりません。",
              });
            case "VeterinarianScheduleConflict":
              return renderBooking(context, dependencies, {
                assignedVeterinarianId: "選択した時間帯には、この獣医師の別の予約があります。",
              });
            case "StaleAppointmentVersion":
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

  app.get("/appointments/:appointmentId/edit", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    return renderEdit(context, dependencies, appointmentId.value);
  });

  app.put("/appointments/:appointmentId", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, UpdateAppointmentSchema);
    if (parsed.isErr()) {
      return renderEdit(context, dependencies, appointmentId.value, parsed.error.errors);
    }
    return dependencies.updateAppointment.run({
      actorUserId: actor.value.user.userId,
      appointmentId: appointmentId.value,
      expectedVersion: parsed.value.expectedVersion,
      ownerId: parsed.value.ownerId,
      petId: parsed.value.petId,
      scheduledAt: parsed.value.scheduledAt,
      durationMinutes: parsed.value.durationMinutes,
      serviceCode: parsed.value.serviceCode,
      assignedVeterinarianId: parsed.value.assignedVeterinarianId,
      visitReason: parsed.value.reason,
    }).match(
      () => context.redirect(detailUrl(appointmentId.value), 303),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "AppointmentNotFound": return respondToUseCaseError(context, { kind: "NotFound" });
          case "InvalidAppointmentState": return invalidState(context, appointmentId.value);
          case "StaleAppointmentVersion": return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
          case "VeterinarianScheduleConflict": return context.redirect(`${detailUrl(appointmentId.value)}?error=schedule-conflict`, 303);
          case "PrepaidAppointmentImmutableFieldsChanged": return context.redirect(`${detailUrl(appointmentId.value)}?error=prepaid-fields`, 303);
          case "OwnerNotFound":
          case "PetNotFound":
          case "PetOwnerMismatch":
          case "VeterinarianNotFound":
            return renderEdit(context, dependencies, appointmentId.value, {
              form: "入力内容を確認してください。",
            });
          case "IdentityGenerationFailed":
          case "RepositoryError": return repositoryFailure(context);
          default: return assertNever(error);
        }
      },
    );
  });

  app.post("/appointments/:appointmentId/veterinarian", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, ReassignVeterinarianSchema);
    if (parsed.isErr()) return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    return dependencies.reassignAppointmentVeterinarian.run({
      actorUserId: actor.value.user.userId,
      appointmentId: appointmentId.value,
      expectedVersion: parsed.value.expectedVersion,
      assignedVeterinarianId: parsed.value.assignedVeterinarianId,
    }).match(
      () => context.redirect(detailUrl(appointmentId.value), 303),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "AppointmentNotFound": return respondToUseCaseError(context, { kind: "NotFound" });
          case "InvalidAppointmentState": return invalidState(context, appointmentId.value);
          case "StaleAppointmentVersion": return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
          case "VeterinarianScheduleConflict": return context.redirect(`${detailUrl(appointmentId.value)}?error=schedule-conflict`, 303);
          case "VeterinarianNotFound": return renderAppointment(context, dependencies, appointmentId.value, { assignedVeterinarianId: "選択した担当獣医師が見つかりません。" });
          case "IdentityGenerationFailed":
          case "RepositoryError": return repositoryFailure(context);
          default: return assertNever(error);
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

  app.post("/appointments/:appointmentId/reception-note", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, ReceptionNoteSchema);
    if (parsed.isErr()) return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    return dependencies.updateReceptionNote.run({
      actorUserId: actor.value.user.userId,
      appointmentId: appointmentId.value,
      expectedVersion: parsed.value.expectedVersion,
      receptionNote: parsed.value.receptionNote,
    }).match(
      () => context.redirect(detailUrl(appointmentId.value), 303),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "AppointmentNotFound": return respondToUseCaseError(context, { kind: "NotFound" });
          case "InvalidAppointmentState": return invalidState(context, appointmentId.value);
          case "StaleAppointmentVersion": return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
          case "IdentityGenerationFailed":
          case "RepositoryError": return repositoryFailure(context);
          default: return assertNever(error);
        }
      },
    );
  });

  app.post("/appointments/:appointmentId/deposit", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, DepositSchema);
    if (parsed.isErr()) return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    return dependencies.receiveAppointmentDeposit.run({
      actorUserId: actor.value.user.userId,
      appointmentId: appointmentId.value,
      expectedVersion: parsed.value.expectedVersion,
      depositAmount: parsed.value.depositAmount,
    }).match(
      () => context.redirect(detailUrl(appointmentId.value), 303),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "AppointmentNotFound": return respondToUseCaseError(context, { kind: "NotFound" });
          case "InvalidDepositAppointmentState": return invalidState(context, appointmentId.value);
          case "DepositNotAllowed": return context.redirect(`${detailUrl(appointmentId.value)}?error=deposit-not-allowed`, 303);
          case "DepositAlreadyReceived": return context.redirect(`${detailUrl(appointmentId.value)}?error=deposit-already-received`, 303);
          case "StaleAppointmentVersion": return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
          case "IdentityGenerationFailed":
          case "RepositoryError": return repositoryFailure(context);
          default: return assertNever(error);
        }
      },
    );
  });

  app.post("/appointments/:appointmentId/check-in", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const appointmentId = parseAppointmentId(context, context.req.param("appointmentId"));
    if (appointmentId.isErr()) return appointmentId.error;
    const parsed = await parseBody(context, CheckInSchema);
    if (parsed.isErr()) return renderAppointment(context, dependencies, appointmentId.value, parsed.error.errors);
    return dependencies.checkInAppointment
      .run({ actorUserId: actor.value.user.userId, appointmentId: appointmentId.value, expectedVersion: parsed.value.expectedVersion })
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
            case "StaleAppointmentVersion":
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
    return dependencies.startExamination
      .run({
        actorUserId: actor.value.user.userId,
        appointmentId: appointmentId.value,
        expectedVersion: parsed.value.expectedVersion,
        veterinarianId: parsed.value.veterinarianId,
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
            case "StaleAppointmentVersion":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=appointment-conflict`, 303);
            case "VeterinarianScheduleConflict":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=schedule-conflict`, 303);
            case "VeterinarianRequired":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=veterinarian-required`, 303);
            case "VeterinarianMismatch":
              return context.redirect(`${detailUrl(appointmentId.value)}?error=veterinarian-mismatch`, 303);
            case "IdentityGenerationFailed":
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
        expectedVersion: parsed.value.expectedVersion,
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
            case "StaleAppointmentVersion":
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
            case "StaleAppointmentVersion":
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
      .run({
        actorUserId: actor.value.user.userId,
        appointmentId: appointmentId.value,
        expectedVersion: parsed.value.expectedVersion,
        reason: parsed.value.reason,
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
            case "StaleAppointmentVersion":
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
