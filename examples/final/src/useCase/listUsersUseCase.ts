import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { Sensitive } from "../domain/shared/sensitive.js";
import { Permission } from "../domain/user/permission.js";
import type { Admin, User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";

export type UserView = Readonly<{
  kind: User["kind"];
  userId: UserId;
  email: Sensitive<string>;
  name: Sensitive<string>;
  veterinarianId?: VeterinarianId;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ users: readonly UserView[] }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError = Unauthorized | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userByIdResolver: UserByIdResolver;
  userListResolver: UserListResolver;
}>;
export type ListUsersUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureActor =
  (actorUserId: UserId) =>
  (user: User | undefined): Result<User, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: User): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const toView = (user: User): UserView =>
  user.kind === "Veterinarian"
    ? {
        kind: user.kind,
        userId: user.userId,
        email: user.email,
        name: user.name,
        veterinarianId: user.veterinarianId,
      }
    : {
        kind: user.kind,
        userId: user.userId,
        email: user.email,
        name: user.name,
      };

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userByIdResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureActor(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userListResolver.resolveAll().mapErr(toRepositoryError),
      )
      .map((users) => ({ users: users.map(toView) }));

export const ListUsersUseCase = {
  create: (dependencies: Dependencies): ListUsersUseCase => ({
    run: run(dependencies),
  }),
} as const;
