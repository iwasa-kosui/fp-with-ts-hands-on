import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { OwnerId, type OwnerId as OwnerIdType } from "../../../../domain/owner/ownerId.js";
import { PetId, type PetId as PetIdType } from "../../../../domain/pet/petId.js";
import { PetName } from "../../../../domain/pet/petName.js";
import { PetSpecies } from "../../../../domain/pet/petSpecies.js";
import type { CreatePetUseCase } from "../../../../useCase/createPetUseCase.js";
import type { DeletePetUseCase } from "../../../../useCase/deletePetUseCase.js";
import type { GetPetUseCase } from "../../../../useCase/getPetUseCase.js";
import type { ListOwnersUseCase } from "../../../../useCase/listOwnersUseCase.js";
import type {
  ListPetsUseCase,
  PetView,
  UseCaseOk as PetList,
} from "../../../../useCase/listPetsUseCase.js";
import type { UpdatePetUseCase } from "../../../../useCase/updatePetUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";
import type { FieldErrors, WebEnvironment } from "../pageProps.js";

const PetProfileShape = {
  name: PetName.schema,
  species: PetSpecies.schema,
};
const CreatePetFormSchema = z.object({
  ownerId: OwnerId.schema,
  ...PetProfileShape,
});
const UpdatePetFormSchema = z.object(PetProfileShape);
const PetDetailErrorSchema = z.enum([
  "pet-has-active-appointment",
  "pet-deletion-conflict",
]);

type PetRouteDependencies = Readonly<{
  listPets: ListPetsUseCase;
  getPet: GetPetUseCase;
  createPet: CreatePetUseCase;
  updatePet: UpdatePetUseCase;
  deletePet: DeletePetUseCase;
  listOwners: ListOwnersUseCase;
}>;

export type PetPageView = Readonly<{
  petId: PetIdType;
  ownerId: OwnerIdType;
  name: string;
  species: string;
}>;
export type PetOwnerOption = Readonly<{
  ownerId: OwnerIdType;
  name: string;
}>;

const toPageView = (pet: PetView): PetPageView => ({
  petId: pet.petId,
  ownerId: pet.ownerId,
  name: pet.name.unwrap(),
  species: pet.species,
});

const parseForm = <TOutput, TInput>(
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

const authorize = async (
  context: Context<WebEnvironment>,
  dependencies: PetRouteDependencies,
): Promise<Result<PetList, Response>> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return err(
      respondToUseCaseError(context, { kind: "Unauthenticated" }),
    );
  }
  const result = await dependencies.listPets.run({
    actorUserId: actor.user.userId,
  });
  return result.mapErr((error) => {
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

const parsePetId = (
  context: Context<WebEnvironment>,
  rawPetId: string,
): Result<PetIdType, Response> => {
  const parsed = PetId.schema.safeParse(rawPetId);
  return parsed.success
    ? ok(parsed.data)
    : err(respondToUseCaseError(context, { kind: "NotFound" }));
};

const loadOwnerOptions = async (
  context: Context<WebEnvironment>,
  dependencies: PetRouteDependencies,
): Promise<Result<readonly PetOwnerOption[], Response>> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return err(
      respondToUseCaseError(context, { kind: "Unauthenticated" }),
    );
  }
  const result = await dependencies.listOwners.run({
    actorUserId: actor.user.userId,
  });
  return result
    .map(({ owners }) =>
      owners.map((owner) => ({
        ownerId: owner.ownerId,
        name: owner.name.unwrap(),
      })),
    )
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

const renderCreate = (
  context: Context<WebEnvironment>,
  owners: readonly PetOwnerOption[],
  errors: FieldErrors = {},
) =>
  context.render(
    "Pets/Form",
    withSharedProps(context, {
      mode: "create" as const,
      pet: null,
      owners,
      errors,
    }),
  );

const renderPet = (
  context: Context<WebEnvironment>,
  pet: PetView,
  errors: FieldErrors = {},
) =>
  context.render(
    "Pets/Form",
    withSharedProps(context, {
      mode: "edit" as const,
      pet: toPageView(pet),
      owners: [] as const,
      errors,
    }),
  );

const loadPet = async (
  context: Context<WebEnvironment>,
  dependencies: PetRouteDependencies,
  petId: PetIdType,
  errors: FieldErrors = {},
): Promise<Response> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return respondToUseCaseError(context, { kind: "Unauthenticated" });
  }
  return dependencies.getPet
    .run({ actorUserId: actor.user.userId, petId })
    .match(
      ({ pet }) => renderPet(context, pet, errors),
      (error) => {
        switch (error.kind) {
          case "Unauthorized":
            return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "PetNotFound":
            return respondToUseCaseError(context, { kind: "NotFound" });
          case "RepositoryError":
            return respondToUseCaseError(context, { kind: "RepositoryError" });
          default:
            return assertNever(error);
        }
      },
    );
};

const petDetailErrors = (rawError: string | undefined): FieldErrors => {
  const parsed = PetDetailErrorSchema.safeParse(rawError);
  if (!parsed.success) return {};
  const code = parsed.data;
  switch (code) {
    case "pet-has-active-appointment":
      return {
        form:
          "進行中の予約があるペットは削除できません。先に予約を確認してください。",
      };
    case "pet-deletion-conflict":
      return {
        form: "ペットを削除できませんでした。最新の状態を確認してください。",
      };
    default:
      return assertNever(code);
  }
};

export const registerPetRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: PetRouteDependencies,
): void => {
  app.get("/pets", async (context) => {
    const authorized = await authorize(context, dependencies);
    return authorized.match(
      (result) =>
        context.render(
          "Pets/Index",
          withSharedProps(context, { pets: result.pets.map(toPageView) }),
        ),
      (response) => response,
    );
  });

  app.get("/pets/new", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const owners = await loadOwnerOptions(context, dependencies);
    return owners.match(
      (options) => renderCreate(context, options),
      (response) => response,
    );
  });

  app.post("/pets", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const parsed = await parseForm(context, CreatePetFormSchema);
    if (parsed.isErr()) {
      const owners = await loadOwnerOptions(context, dependencies);
      return owners.match(
        (options) => renderCreate(context, options, parsed.error.errors),
        (response) => response,
      );
    }

    return dependencies.createPet
      .run({ actorUserId: actor.user.userId, ...parsed.value })
      .match(
        () => context.redirect("/pets"),
        async (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "OwnerNotFound": {
              const owners = await loadOwnerOptions(context, dependencies);
              return owners.match(
                (options) =>
                  renderCreate(context, options, {
                    ownerId: "選択した飼い主が見つかりません",
                  }),
                (response) => response,
              );
            }
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return respondToUseCaseError(context, {
                kind: "RepositoryError",
              });
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.get("/pets/:petId", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const petId = parsePetId(context, context.req.param("petId"));
    return petId.match(
      (value) =>
        loadPet(
          context,
          dependencies,
          value,
          petDetailErrors(context.req.query("error")),
        ),
      (response) => response,
    );
  });

  app.post("/pets/:petId", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const petId = parsePetId(context, context.req.param("petId"));
    if (petId.isErr()) return petId.error;
    const parsed = await parseForm(context, UpdatePetFormSchema);
    if (parsed.isErr()) {
      return loadPet(
        context,
        dependencies,
        petId.value,
        parsed.error.errors,
      );
    }

    return dependencies.updatePet
      .run({ actorUserId: actor.user.userId, petId: petId.value, ...parsed.value })
      .match(
        () => context.redirect("/pets"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "PetNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return respondToUseCaseError(context, {
                kind: "RepositoryError",
              });
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/pets/:petId/delete", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const petId = parsePetId(context, context.req.param("petId"));
    if (petId.isErr()) return petId.error;

    return dependencies.deletePet
      .run({ actorUserId: actor.user.userId, petId: petId.value })
      .match(
        () => context.redirect("/pets"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "PetNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "PetHasActiveAppointment":
              return context.redirect(
                `/pets/${petId.value}?error=pet-has-active-appointment`,
                303,
              );
            case "PetDeletionConflict":
              return context.redirect(
                `/pets/${petId.value}?error=pet-deletion-conflict`,
                303,
              );
            case "IdentityGenerationFailed":
            case "RepositoryError":
              return respondToUseCaseError(context, {
                kind: "RepositoryError",
              });
            default:
              return assertNever(error);
          }
        },
      );
  });
};
