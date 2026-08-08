import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { PlaintextPassword } from "../../../../domain/user/plaintextPassword.js";
import type { User } from "../../../../domain/user/user.js";
import { UserEmail } from "../../../../domain/user/userEmail.js";
import { UserId, type UserId as UserIdType } from "../../../../domain/user/userId.js";
import { UserName } from "../../../../domain/user/userName.js";
import type { CreateUserUseCase } from "../../../../useCase/createUserUseCase.js";
import type { DeleteUserUseCase } from "../../../../useCase/deleteUserUseCase.js";
import type {
  ListUsersUseCase,
  UseCaseOk as UserList,
  UserView,
} from "../../../../useCase/listUsersUseCase.js";
import type { ResetUserPasswordUseCase } from "../../../../useCase/resetUserPasswordUseCase.js";
import type { UpdateUserUseCase } from "../../../../useCase/updateUserUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";
import type { FieldErrors, WebEnvironment } from "../pageProps.js";

const RoleSchema = z.enum(["Admin", "Receptionist", "Veterinarian"]);
const CreateUserFormSchema = z.object({
  email: UserEmail.schema,
  name: UserName.schema,
  password: PlaintextPassword.schema,
  role: RoleSchema,
});
const UpdateUserFormSchema = z.object({
  email: UserEmail.schema,
  name: UserName.schema,
  role: RoleSchema,
});
const ResetPasswordFormSchema = z.object({
  password: PlaintextPassword.schema,
});
const UserIndexErrorSchema = z.enum([
  "cannot-delete-self",
  "cannot-delete-last-admin",
]);

type UserRouteDependencies = Readonly<{
  listUsers: ListUsersUseCase;
  createUser: CreateUserUseCase;
  updateUser: UpdateUserUseCase;
  resetUserPassword: ResetUserPasswordUseCase;
  deleteUser: DeleteUserUseCase;
}>;

export type UserPageView = Readonly<{
  userId: UserIdType;
  role: User["kind"];
  email: string;
  name: string;
}>;

const toPageView = (user: UserView): UserPageView => ({
  userId: user.userId,
  role: user.kind,
  email: user.email.unwrap(),
  name: user.name.unwrap(),
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
  dependencies: UserRouteDependencies,
): Promise<Result<UserList, Response>> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return err(
      respondToUseCaseError(context, { kind: "Unauthenticated" }),
    );
  }
  const result = await dependencies.listUsers.run({
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

const parseUserId = (
  context: Context<WebEnvironment>,
  rawUserId: string,
): Result<UserIdType, Response> => {
  const parsed = UserId.schema.safeParse(rawUserId);
  return parsed.success
    ? ok(parsed.data)
    : err(respondToUseCaseError(context, { kind: "NotFound" }));
};

const renderCreate = (
  context: Context<WebEnvironment>,
  errors: FieldErrors = {},
) =>
  context.render(
    "Users/Form",
    withSharedProps(context, { mode: "create" as const, user: null, errors }),
  );

const renderEdit = (
  context: Context<WebEnvironment>,
  users: UserList,
  userId: UserIdType,
  errors: FieldErrors = {},
) => {
  const user = users.users.find((candidate) => candidate.userId === userId);
  return user === undefined
    ? respondToUseCaseError(context, { kind: "NotFound" })
    : context.render(
        "Users/Form",
        withSharedProps(context, {
          mode: "edit" as const,
          user: toPageView(user),
          errors,
        }),
      );
};

const userIndexErrors = (rawError: string | undefined): FieldErrors => {
  const parsed = UserIndexErrorSchema.safeParse(rawError);
  if (!parsed.success) return {};
  const code = parsed.data;
  switch (code) {
    case "cannot-delete-self":
      return { form: "自分自身のアカウントは削除できません。" };
    case "cannot-delete-last-admin":
      return { form: "最後の管理者アカウントは削除できません。" };
    default:
      return assertNever(code);
  }
};

export const registerUserRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: UserRouteDependencies,
): void => {
  app.get("/users", async (context) => {
    const authorized = await authorize(context, dependencies);
    return authorized.match(
      (result) =>
        context.render(
          "Users/Index",
          withSharedProps(context, {
            users: result.users.map(toPageView),
            errors: userIndexErrors(context.req.query("error")),
          }),
        ),
      (response) => response,
    );
  });

  app.get("/users/new", async (context) => {
    const authorized = await authorize(context, dependencies);
    return authorized.match(
      () => renderCreate(context),
      (response) => response,
    );
  });

  app.post("/users", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const parsed = await parseForm(context, CreateUserFormSchema);
    if (parsed.isErr()) return renderCreate(context, parsed.error.errors);

    return dependencies.createUser
      .run({ actorUserId: actor.user.userId, ...parsed.value })
      .match(
        () => context.redirect("/users"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "UserEmailAlreadyExists":
              return renderCreate(context, {
                email: "このメールアドレスは既に使用されています",
              });
            case "PasswordHashingFailed":
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

  app.get("/users/:userId/edit", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const userId = parseUserId(context, context.req.param("userId"));
    return userId.match(
      (value) => renderEdit(context, authorized.value, value),
      (response) => response,
    );
  });

  app.post("/users/:userId", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const userId = parseUserId(context, context.req.param("userId"));
    if (userId.isErr()) return userId.error;
    const parsed = await parseForm(context, UpdateUserFormSchema);
    if (parsed.isErr()) {
      return renderEdit(
        context,
        authorized.value,
        userId.value,
        parsed.error.errors,
      );
    }

    return dependencies.updateUser
      .run({
        actorUserId: actor.user.userId,
        targetUserId: userId.value,
        ...parsed.value,
      })
      .match(
        () => context.redirect("/users"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "UserNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "UserEmailAlreadyExists":
              return renderEdit(context, authorized.value, userId.value, {
                email: "このメールアドレスは既に使用されています",
              });
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

  app.post("/users/:userId/reset-password", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const userId = parseUserId(context, context.req.param("userId"));
    if (userId.isErr()) return userId.error;
    const parsed = await parseForm(context, ResetPasswordFormSchema);
    if (parsed.isErr()) {
      return renderEdit(
        context,
        authorized.value,
        userId.value,
        parsed.error.errors,
      );
    }

    return dependencies.resetUserPassword
      .run({
        actorUserId: actor.user.userId,
        targetUserId: userId.value,
        password: parsed.value.password,
      })
      .match(
        () => context.redirect("/users"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "UserNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "PasswordHashingFailed":
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

  app.post("/users/:userId/delete", async (context) => {
    const authorized = await authorize(context, dependencies);
    if (authorized.isErr()) return authorized.error;
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    const userId = parseUserId(context, context.req.param("userId"));
    if (userId.isErr()) return userId.error;

    return dependencies.deleteUser
      .run({
        actorUserId: actor.user.userId,
        targetUserId: userId.value,
      })
      .match(
        () => context.redirect("/users"),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "UserNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "CannotDeleteSelf":
              return context.redirect(
                "/users?error=cannot-delete-self",
                303,
              );
            case "CannotDeleteLastAdmin":
              return context.redirect(
                "/users?error=cannot-delete-last-admin",
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
