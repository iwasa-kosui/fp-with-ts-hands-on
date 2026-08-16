import { err, ok, type Result, type ResultAsync } from "neverthrow";

import { Permission } from "../domain/user/permission.js";
import type { Admin, User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
import { toUserView, type UserView } from "./userView.js";

export type { UserView } from "./userView.js";
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ users: readonly UserView[] }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UseCaseError = Unauthorized;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userByIdResolver: UserByIdResolver;
  userListResolver: UserListResolver;
}>;
export type ListUsersUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureActor =
  (actorUserId: UserId) =>
  (user: User | undefined): Result<User, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: User): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userByIdResolver
      .resolveById(input.actorUserId)
      .andThen(ensureActor(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userListResolver.resolveAll(),
      )
      .map((users) => ({ users: users.map(toUserView) }));

export const ListUsersUseCase = {
  create: (dependencies: Dependencies): ListUsersUseCase => ({
    run: run(dependencies),
  }),
} as const;
