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
import { assertNever } from "../domain/shared/assertNever.js";
import { Permission } from "../domain/user/permission.js";
import {
  User,
  type Admin,
  type User as UserState,
} from "../domain/user/user.js";
import type { UserEmail } from "../domain/user/userEmail.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserName } from "../domain/user/userName.js";
import type {
  PasswordHasher,
  PlaintextPassword,
} from "../domain/user/passwordHasher.js";
import type {
  UserByEmailResolver,
  UserByIdResolver,
} from "../domain/user/userResolver.js";
import type { UserCreatedStore } from "../domain/user/userStores.js";
import { toUserView, type UserView } from "./userView.js";

export type { UserView } from "./userView.js";
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  email: UserEmail;
  name: UserName;
  password: PlaintextPassword;
  role: UserState["kind"];
}>;
export type UseCaseOk = Readonly<{ user: UserView }>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type UserEmailAlreadyExists = Readonly<{
  kind: "UserEmailAlreadyExists";
}>;
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
  | UserEmailAlreadyExists
  | PasswordHashingFailed
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type UserIdGenerator = Readonly<{ generate: () => UserId }>;
export type VeterinarianIdGenerator = Readonly<{
  generate: () => VeterinarianId;
}>;
export type Dependencies = Readonly<{
  userByIdResolver: UserByIdResolver;
  userByEmailResolver: UserByEmailResolver;
  userCreatedStore: UserCreatedStore;
  passwordHasher: PasswordHasher;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
  userIdGenerator: UserIdGenerator;
  veterinarianIdGenerator: VeterinarianIdGenerator;
}>;
export type CreateUserUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureUser =
  (actorUserId: UserId) =>
  (user: UserState | undefined): Result<UserState, Unauthorized> =>
    user === undefined ? err({ kind: "Unauthorized", actorUserId }) : ok(user);
const ensureAdmin = (user: UserState): Result<Admin, Unauthorized> =>
  Permission.isAdmin(user)
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureEmailAvailable = (
  user: UserState | undefined,
): Result<void, UserEmailAlreadyExists> =>
  user === undefined ? ok(undefined) : err({ kind: "UserEmailAlreadyExists" });
const hashPassword = (
  passwordHasher: PasswordHasher,
  password: PlaintextPassword,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => passwordHasher.hash(password)),
    (): PasswordHashingFailed => ({ kind: "PasswordHashingFailed" }),
  );
const createState = (
  dependencies: Dependencies,
  input: UseCaseInput,
  passwordHash: Awaited<ReturnType<PasswordHasher["hash"]>>,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then((): UserState => {
      const base = {
        userId: dependencies.userIdGenerator.generate(),
        email: input.email,
        name: input.name,
        passwordHash,
      } as const;
      switch (input.role) {
        case "Admin":
          return { kind: "Admin", ...base };
        case "Receptionist":
          return { kind: "Receptionist", ...base };
        case "Veterinarian":
          return {
            kind: "Veterinarian",
            ...base,
            veterinarianId: dependencies.veterinarianIdGenerator.generate(),
          };
        default:
          return assertNever(input.role);
      }
    }),
    (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
  );
const createEvent =
  (dependencies: Dependencies, actorUserId: UserId) => (user: UserState) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        User.create({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId,
        })(user),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userByIdResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUser(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.userByEmailResolver
          .resolveByEmail(input.email)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureEmailAvailable)
      .andThen(() => hashPassword(dependencies.passwordHasher, input.password))
      .andThen((passwordHash) => createState(dependencies, input, passwordHash))
      .andThen(createEvent(dependencies, input.actorUserId))
      .andThrough((event) =>
        dependencies.userCreatedStore.store(event).mapErr(toRepositoryError),
      )
      .map((event) => ({ user: toUserView(event.aggregateState) }));

export const CreateUserUseCase = {
  create: (dependencies: Dependencies): CreateUserUseCase => ({
    run: run(dependencies),
  }),
} as const;
