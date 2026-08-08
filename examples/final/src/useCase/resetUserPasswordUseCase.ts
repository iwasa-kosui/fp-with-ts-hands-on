import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { Sensitive } from "../domain/shared/sensitive.js";
import { Permission } from "../domain/user/permission.js";
import {
  User,
  type Admin,
  type User as UserState,
} from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  PasswordHasher,
  PlaintextPassword,
} from "../domain/user/passwordHasher.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import type { UserPasswordResetStore } from "../domain/user/userStores.js";

export type UserView = Readonly<{
  kind: UserState["kind"];
  userId: UserId;
  email: Sensitive<string>;
  name: Sensitive<string>;
  veterinarianId?: VeterinarianId;
}>;
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  targetUserId: UserId;
  password: PlaintextPassword;
}>;
export type UseCaseOk = Readonly<{ user: UserView }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UserNotFound = Readonly<{ kind: "UserNotFound"; userId: UserId }>;
export type PasswordHashingFailed = Readonly<{ kind: "PasswordHashingFailed" }>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | Unauthorized
  | UserNotFound
  | PasswordHashingFailed
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  userPasswordResetStore: UserPasswordResetStore;
  passwordHasher: PasswordHasher;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type ResetUserPasswordUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureActor =
  (actorUserId: UserId) =>
  (user: UserState | undefined): Result<UserState, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: UserState): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureTarget =
  (userId: UserId) =>
  (user: UserState | undefined): Result<UserState, UserNotFound> =>
    user === undefined ? err({ kind: "UserNotFound", userId }) : ok(user);
const hashPassword = (
  passwordHasher: PasswordHasher,
  password: PlaintextPassword,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => passwordHasher.hash(password)),
    (): PasswordHashingFailed => ({ kind: "PasswordHashingFailed" }),
  );
const createEvent =
  (dependencies: Dependencies, actorUserId: UserId, user: UserState) =>
  (passwordHash: Awaited<ReturnType<PasswordHasher["hash"]>>) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        User.resetPassword({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId,
        })(user, passwordHash),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const toView = (user: UserState): UserView =>
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
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureActor(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userResolver
          .resolveById(input.targetUserId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureTarget(input.targetUserId))
      .andThen((user) =>
        hashPassword(dependencies.passwordHasher, input.password).andThen(
          createEvent(dependencies, input.actorUserId, user),
        ),
      )
      .andThrough((event) =>
        dependencies.userPasswordResetStore
          .store(event)
          .mapErr(toRepositoryError),
      )
      .map((event) => ({ user: toView(event.aggregateState) }));

export const ResetUserPasswordUseCase = {
  create: (dependencies: Dependencies): ResetUserPasswordUseCase => ({
    run: run(dependencies),
  }),
} as const;
