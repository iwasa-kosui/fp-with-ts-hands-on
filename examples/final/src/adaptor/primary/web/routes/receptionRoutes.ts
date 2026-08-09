import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";
import { AppointmentDuration } from "../../../../domain/appointment/appointmentDuration.js";
import { AppointmentReason } from "../../../../domain/appointment/appointmentReason.js";
import { ReceptionNote } from "../../../../domain/appointment/receptionNote.js";
import { ServiceCode } from "../../../../domain/appointment/serviceCode.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import type { ListOwnersUseCase } from "../../../../useCase/listOwnersUseCase.js";
import type { ListPetsUseCase } from "../../../../useCase/listPetsUseCase.js";
import type { ListVeterinariansUseCase } from "../../../../useCase/listVeterinariansUseCase.js";
import type { RegisterWalkInUseCase } from "../../../../useCase/registerWalkInUseCase.js";
import type { GetReceptionBoardUseCase } from "../../../../useCase/getReceptionBoardUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import { assertNever, issuesToFieldErrors, respondToUseCaseError, type ValidationError } from "../middleware/useCaseResponse.js";
import type { AuthenticatedActor, FieldErrors, WebEnvironment } from "../pageProps.js";

const WalkInSchema = z.object({
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  serviceCode: ServiceCode.schema,
  durationMinutes: z.coerce.number().pipe(AppointmentDuration.schema),
  assignedVeterinarianId: z.preprocess((value) => value === "" ? null : value, VeterinarianId.schema.nullable()),
  reason: AppointmentReason.schema,
  receptionNote: z.preprocess((value) => value === "" ? null : value, ReceptionNote.schema.nullable()),
});
type Dependencies = Readonly<{
  getReceptionBoard: GetReceptionBoardUseCase;
  listOwners: ListOwnersUseCase;
  listPets: ListPetsUseCase;
  listVeterinarians: ListVeterinariansUseCase;
  registerWalkIn: RegisterWalkInUseCase;
}>;
const requireActor = (context: Context<WebEnvironment>): Result<AuthenticatedActor, Response> => {
  const actor = context.get("actor");
  return actor === undefined
    ? err(respondToUseCaseError(context, { kind: "Unauthenticated" }))
    : ok(actor);
};
const requireManager = (context: Context<WebEnvironment>): Result<AuthenticatedActor, Response> => {
  const actor = requireActor(context);
  if (actor.isErr()) return actor;
  return actor.value.user.kind === "Admin" || actor.value.user.kind === "Receptionist"
    ? actor
    : err(respondToUseCaseError(context, { kind: "Unauthorized" }));
};
const parseBody = (context: Context<WebEnvironment>) => ResultAsync.fromPromise(
  context.req.parseBody(),
  (): ValidationError => ({ kind: "ValidationError", errors: { form: "入力内容を確認してください。" } }),
).andThen((body) => {
  const parsed = WalkInSchema.safeParse(body);
  return parsed.success
    ? ok(parsed.data)
    : err({
        kind: "ValidationError",
        errors: issuesToFieldErrors(parsed.error.issues),
      } as const satisfies ValidationError);
});
const loadOptions = async (context: Context<WebEnvironment>, dependencies: Dependencies, actor: AuthenticatedActor) => {
  const owners = await dependencies.listOwners.run({ actorUserId: actor.user.userId });
  if (owners.isErr()) return err(respondToUseCaseError(context, { kind: owners.error.kind === "Unauthorized" ? "Unauthorized" : "RepositoryError" }));
  const pets = await dependencies.listPets.run({ actorUserId: actor.user.userId });
  if (pets.isErr()) return err(respondToUseCaseError(context, { kind: pets.error.kind === "Unauthorized" ? "Unauthorized" : "RepositoryError" }));
  const veterinarians = await dependencies.listVeterinarians.run({ actorUserId: actor.user.userId });
  if (veterinarians.isErr()) return err(respondToUseCaseError(context, { kind: veterinarians.error.kind === "Unauthorized" ? "Unauthorized" : "RepositoryError" }));
  return ok({
    owners: owners.value.owners.map((owner) => ({ ownerId: owner.ownerId, name: owner.name.unwrap() })),
    pets: pets.value.pets.map((pet) => ({ petId: pet.petId, ownerId: pet.ownerId, name: pet.name.unwrap() })),
    veterinarians: veterinarians.value.veterinarians.map((veterinarian) => ({ veterinarianId: veterinarian.veterinarianId, name: veterinarian.name.unwrap() })),
  });
};
const renderWalkIn = async (context: Context<WebEnvironment>, dependencies: Dependencies, actor: AuthenticatedActor, errors: FieldErrors = {}) => {
  const options = await loadOptions(context, dependencies, actor);
  return options.match(
    (values) => context.render("Reception/WalkIn", withSharedProps(context, { ...values, errors })),
    (response) => response,
  );
};
export const registerReceptionRoutes = (app: Hono<WebEnvironment>, dependencies: Dependencies): void => {
  app.get("/reception", async (context) => {
    const actor = requireActor(context);
    if (actor.isErr()) return actor.error;
    const result = await dependencies.getReceptionBoard.run({ actorUserId: actor.value.user.userId });
    return result.match(
      ({ board }) => context.render("Reception/Index", withSharedProps(context, { board, currentTime: board.loadedAt })),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "RepositoryError": return respondToUseCaseError(context, { kind: "RepositoryError" });
          default: return assertNever(error);
        }
      },
    );
  });
  app.get("/reception/walk-ins/new", (context) => {
    const actor = requireManager(context);
    return actor.isErr() ? actor.error : renderWalkIn(context, dependencies, actor.value);
  });
  app.post("/reception/walk-ins", async (context) => {
    const actor = requireManager(context);
    if (actor.isErr()) return actor.error;
    const parsed = await parseBody(context);
    if (parsed.isErr()) return renderWalkIn(context, dependencies, actor.value, parsed.error.errors);
    return dependencies.registerWalkIn.run({ actorUserId: actor.value.user.userId, ...parsed.value, visitReason: parsed.value.reason }).match(
      ({ appointment }) => context.redirect(`/appointments/${appointment.appointmentId}`, 303),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "OwnerNotFound": return renderWalkIn(context, dependencies, actor.value, { ownerId: "選択した飼い主が見つかりません。" });
          case "PetNotFound":
          case "PetOwnerMismatch": return renderWalkIn(context, dependencies, actor.value, { petId: "選択した飼い主に登録されたペットを選んでください。" });
          case "VeterinarianNotFound": return renderWalkIn(context, dependencies, actor.value, { assignedVeterinarianId: "選択した担当獣医師が見つかりません。" });
          case "VeterinarianScheduleConflict": return renderWalkIn(context, dependencies, actor.value, { assignedVeterinarianId: "選択した時間帯には、この獣医師の別の予約があります。" });
          case "IdentityGenerationFailed":
          case "RepositoryError": return respondToUseCaseError(context, { kind: "RepositoryError" });
          default: return assertNever(error);
        }
      },
    );
  });
};
