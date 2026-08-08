import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { OwnerEmail } from "../../../../domain/owner/ownerEmail.js";
import { OwnerId, type OwnerId as OwnerIdType } from "../../../../domain/owner/ownerId.js";
import { OwnerName } from "../../../../domain/owner/ownerName.js";
import { OwnerPhone } from "../../../../domain/owner/ownerPhone.js";
import type { CreateOwnerUseCase } from "../../../../useCase/createOwnerUseCase.js";
import type { DeleteOwnerUseCase } from "../../../../useCase/deleteOwnerUseCase.js";
import type { GetOwnerUseCase } from "../../../../useCase/getOwnerUseCase.js";
import type {
  ListOwnersUseCase,
  OwnerView,
  UseCaseOk as OwnerList,
} from "../../../../useCase/listOwnersUseCase.js";
import type { UpdateOwnerUseCase } from "../../../../useCase/updateOwnerUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";
import type { FieldErrors, WebEnvironment } from "../pageProps.js";

const OwnerFormSchema = z.object({
  name: OwnerName.schema,
  email: OwnerEmail.schema,
  phone: OwnerPhone.schema,
});

type OwnerRouteDependencies = Readonly<{
  listOwners: ListOwnersUseCase;
  getOwner: GetOwnerUseCase;
  createOwner: CreateOwnerUseCase;
  updateOwner: UpdateOwnerUseCase;
  deleteOwner: DeleteOwnerUseCase;
}>;

export type OwnerPageView = Readonly<{
  ownerId: OwnerIdType;
  name: string;
  email: string;
  phone: string;
}>;

const toPageView = (owner: OwnerView): OwnerPageView => ({
  ownerId: owner.ownerId,
  name: owner.name,
  email: owner.email,
  phone: owner.phone,
});

const parseForm = (
  context: Context<WebEnvironment>,
) =>
  ResultAsync.fromPromise(
    context.req.parseBody(),
    (): ValidationError => ({
      kind: "ValidationError",
      errors: { form: "入力内容を確認してください" },
    }),
  ).andThen((body) => {
    const parsed = OwnerFormSchema.safeParse(body);
    return parsed.success
      ? ok(parsed.data)
      : err({
          kind: "ValidationError",
          errors: issuesToFieldErrors(parsed.error.issues),
        } as const satisfies ValidationError);
  });

const authorize = async (
  context: Context<WebEnvironment>,
  dependencies: OwnerRouteDependencies,
): Promise<Result<OwnerList, Response>> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return err(
      respondToUseCaseError(context, { kind: "Unauthenticated" }),
    );
  }
  const result = await dependencies.listOwners.run({
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

const parseOwnerId = (
  context: Context<WebEnvironment>,
  rawOwnerId: string,
): Result<OwnerIdType, Response> => {
  const parsed = OwnerId.schema.safeParse(rawOwnerId);
  return parsed.success
    ? ok(parsed.data)
    : err(respondToUseCaseError(context, { kind: "NotFound" }));
};

const renderCreate = (
  context: Context<WebEnvironment>,
  errors: FieldErrors = {},
) =>
  context.render(
    "Owners/Form",
    withSharedProps(context, { mode: "create" as const, owner: null, errors }),
  );

const renderOwner = (
  context: Context<WebEnvironment>,
  owner: OwnerView,
  errors: FieldErrors = {},
) =>
  context.render(
    "Owners/Form",
    withSharedProps(context, {
      mode: "edit" as const,
      owner: toPageView(owner),
      errors,
    }),
  );

const loadOwner = async (
  context: Context<WebEnvironment>,
  dependencies: OwnerRouteDependencies,
  ownerId: OwnerIdType,
  errors: FieldErrors = {},
): Promise<Response> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return respondToUseCaseError(context, { kind: "Unauthenticated" });
  }
  return dependencies.getOwner
    .run({ actorUserId: actor.user.userId, ownerId })
    .match(
      ({ owner }) => renderOwner(context, owner, errors),
      (error) => {
        switch (error.kind) {
          case "Unauthorized":
            return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "OwnerNotFound":
            return respondToUseCaseError(context, { kind: "NotFound" });
          case "RepositoryError":
            return respondToUseCaseError(context, { kind: "RepositoryError" });
          default:
            return assertNever(error);
        }
      },
    );
};

export const registerOwnerRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: OwnerRouteDependencies,
): void => {
  app.get("/owners", async (context) => {
    const authorized = await authorize(context, dependencies);
    return authorized.match(
      (result) =>
        context.render(
          "Owners/Index",
          withSharedProps(context, {
            owners: result.owners.map(toPageView),
          }),
        ),
      (response) => response,
    );
  });

  app.get("/owners/new", async (context) => {
    const authorized = await authorize(context, dependencies);
    return authorized.match(
      () => renderCreate(context),
      (response) => response,
    );
  });

  app.post("/owners", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const parsed = await parseForm(context);
    if (parsed.isErr()) return renderCreate(context, parsed.error.errors);

    return dependencies.createOwner
      .run({ actorUserId: actor.user.userId, ...parsed.value })
      .match(
        () => context.redirect("/owners"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
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

  app.get("/owners/:ownerId", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const ownerId = parseOwnerId(context, context.req.param("ownerId"));
    return ownerId.match(
      (value) => loadOwner(context, dependencies, value),
      (response) => response,
    );
  });

  app.post("/owners/:ownerId", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const ownerId = parseOwnerId(context, context.req.param("ownerId"));
    if (ownerId.isErr()) return ownerId.error;
    const parsed = await parseForm(context);
    if (parsed.isErr()) {
      return loadOwner(
        context,
        dependencies,
        ownerId.value,
        parsed.error.errors,
      );
    }

    return dependencies.updateOwner
      .run({
        actorUserId: actor.user.userId,
        ownerId: ownerId.value,
        ...parsed.value,
      })
      .match(
        () => context.redirect("/owners"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "OwnerNotFound":
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

  app.post("/owners/:ownerId/delete", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const ownerId = parseOwnerId(context, context.req.param("ownerId"));
    if (ownerId.isErr()) return ownerId.error;

    return dependencies.deleteOwner
      .run({ actorUserId: actor.user.userId, ownerId: ownerId.value })
      .match(
        () => context.redirect("/owners"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "OwnerNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "OwnerHasPets":
            case "OwnerDeletionConflict":
              return respondToUseCaseError(context, { kind: "Conflict" });
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
