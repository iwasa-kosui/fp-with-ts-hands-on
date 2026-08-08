import {
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Timestamp,
  type Timestamp as TimestampValue,
} from "../domain/aggregate/timestamp.js";
import { Session } from "../domain/session/session.js";
import type { SessionId } from "../domain/session/sessionId.js";
import type { SessionTokenGenerator } from "../domain/session/sessionTokenGenerator.js";
import type { Sensitive } from "../domain/shared/sensitive.js";
import { User } from "../domain/user/user.js";
import type { UserEmail } from "../domain/user/userEmail.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserName } from "../domain/user/userName.js";
import type {
  PasswordHasher,
  PlaintextPassword,
} from "../domain/user/passwordHasher.js";
import type {
  InitialAdminAlreadyExists,
  InitialAdminSetupStore,
} from "./persistence/initialAdminSetupStore.js";

const sessionDurationMs = 8 * 60 * 60 * 1_000;

export type UseCaseInput = Readonly<{
  email: UserEmail;
  name: UserName;
  password: PlaintextPassword;
}>;

export type UseCaseOk = Readonly<{
  userId: UserId;
  sessionId: SessionId;
  expiresAt: TimestampValue;
  sessionToken: Sensitive<string>;
}>;

export type { InitialAdminAlreadyExists } from "./persistence/initialAdminSetupStore.js";
export type PasswordHashingFailed = Readonly<{ kind: "PasswordHashingFailed" }>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type SessionCreationFailed = Readonly<{ kind: "SessionCreationFailed" }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;

export type UseCaseError =
  | InitialAdminAlreadyExists
  | PasswordHashingFailed
  | IdentityGenerationFailed
  | SessionCreationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;

export type UserIdGenerator = Readonly<{ generate: () => UserId }>;
export type SessionIdGenerator = Readonly<{ generate: () => SessionId }>;

export type Dependencies = Readonly<{
  initialAdminSetupStore: InitialAdminSetupStore;
  passwordHasher: PasswordHasher;
  sessionTokenGenerator: SessionTokenGenerator;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
  userIdGenerator: UserIdGenerator;
  sessionIdGenerator: SessionIdGenerator;
}>;

export type SetUpInitialAdminUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});

const hashPassword = (
  passwordHasher: PasswordHasher,
  password: PlaintextPassword,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => passwordHasher.hash(password)),
    (): PasswordHashingFailed => ({ kind: "PasswordHashingFailed" }),
  );

const expirationFrom = (
  occurredAt: TimestampValue,
): Result<TimestampValue, SessionCreationFailed> =>
  Timestamp.parse(
    new Date(Date.parse(occurredAt) + sessionDurationMs).toISOString(),
  ).mapErr(() => ({ kind: "SessionCreationFailed" }));

const generateInitialAdmin = (
  dependencies: Dependencies,
  input: UseCaseInput,
  passwordHash: Awaited<ReturnType<PasswordHasher["hash"]>>,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const userId = dependencies.userIdGenerator.generate();
      const user = {
        kind: "Admin",
        userId,
        email: input.email,
        name: input.name,
        passwordHash,
      } as const;
      return User.create({
        eventId: dependencies.eventIdGenerator.generate(),
        occurredAt: dependencies.clock.now(),
        actorUserId: userId,
      })(user);
    }),
    (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
  );

const generateSession = (dependencies: Dependencies, userId: UserId) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => ({
      sessionId: dependencies.sessionIdGenerator.generate(),
      token: dependencies.sessionTokenGenerator.generate(),
      eventId: dependencies.eventIdGenerator.generate(),
      occurredAt: dependencies.clock.now(),
    })),
    (): SessionCreationFailed => ({ kind: "SessionCreationFailed" }),
  )
    .andThen((generated) =>
      expirationFrom(generated.occurredAt).map((expiresAt) => ({
        ...generated,
        expiresAt,
      })),
    )
    .map((generated) => ({
      event: Session.create({
        eventId: generated.eventId,
        occurredAt: generated.occurredAt,
        actorUserId: userId,
      })({
        sessionId: generated.sessionId,
        userId,
        tokenHash: generated.token.hash,
        expiresAt: generated.expiresAt,
      }),
      token: generated.token.plaintext,
    }));

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    hashPassword(dependencies.passwordHasher, input.password)
      .andThen((passwordHash) =>
        generateInitialAdmin(dependencies, input, passwordHash),
      )
      .andThen((userEvent) =>
        generateSession(dependencies, userEvent.aggregateState.userId).map(
          (sessionResult) => ({ userEvent, sessionResult }),
        ),
      )
      .andThrough(({ userEvent, sessionResult }) =>
        dependencies.initialAdminSetupStore
          .store(userEvent, sessionResult.event)
          .mapErr((error) =>
            error.kind === "RepositoryError"
              ? toRepositoryError(error)
              : error,
          ),
      )
      .map(({ sessionResult }) => ({
        userId: sessionResult.event.aggregateState.userId,
        sessionId: sessionResult.event.aggregateState.sessionId,
        expiresAt: sessionResult.event.aggregateState.expiresAt,
        sessionToken: sessionResult.token,
      }));

export const SetUpInitialAdminUseCase = {
  create: (dependencies: Dependencies): SetUpInitialAdminUseCase => ({
    run: run(dependencies),
  }),
} as const;
