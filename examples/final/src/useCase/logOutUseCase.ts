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
import {
  Session,
  type Session as SessionState,
} from "../domain/session/session.js";
import type { SessionId } from "../domain/session/sessionId.js";
import type { SessionByIdResolver } from "../domain/session/sessionResolver.js";
import type { SessionDeletedStore } from "../domain/session/sessionStores.js";
import type { UserId } from "../domain/user/userId.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  sessionId: SessionId;
}>;
export type UseCaseOk = Readonly<{ sessionId: SessionId }>;
export type SessionNotFound = Readonly<{
  kind: "SessionNotFound";
  sessionId: SessionId;
}>;
export type Unauthorized = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;
export type SessionInvalidationFailed = Readonly<{
  kind: "SessionInvalidationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | SessionNotFound
  | Unauthorized
  | SessionInvalidationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  sessionResolver: SessionByIdResolver;
  sessionDeletedStore: SessionDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type LogOutUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureSession =
  (sessionId: SessionId) =>
  (session: SessionState | undefined): Result<SessionState, SessionNotFound> =>
    session === undefined
      ? err({ kind: "SessionNotFound", sessionId })
      : ok(session);
const ensureOwnedBy =
  (actorUserId: UserId) =>
  (session: SessionState): Result<SessionState, Unauthorized> =>
    session.userId === actorUserId
      ? ok(session)
      : err({ kind: "Unauthorized", actorUserId });
const createDeletionEvent =
  (dependencies: Dependencies, actorUserId: UserId) =>
  (session: SessionState) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Session.delete({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId,
        })(session),
      ),
      (): SessionInvalidationFailed => ({ kind: "SessionInvalidationFailed" }),
    );

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.sessionResolver
      .resolveById(input.sessionId)
      .mapErr(toRepositoryError)
      .andThen(ensureSession(input.sessionId))
      .andThen(ensureOwnedBy(input.actorUserId))
      .andThen(createDeletionEvent(dependencies, input.actorUserId))
      .andThrough((event) =>
        dependencies.sessionDeletedStore.store(event).mapErr(toRepositoryError),
      )
      .map((event) => ({ sessionId: event.aggregateId }));

export const LogOutUseCase = {
  create: (dependencies: Dependencies): LogOutUseCase => ({
    run: run(dependencies),
  }),
} as const;
