import { err, ok, type Result, type ResultAsync } from "neverthrow";

import { createSensitiveAuditPayloadViewed } from "../domain/aggregate/auditEvent.js";
import type { Clock } from "../domain/aggregate/clock.js";
import type { EventId } from "../domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Admin, User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type {
  AuditEventNotFound,
  AuditPayloadNotSensitive,
  SensitiveAuditPayload,
  SensitiveAuditPayloadDisclosure,
  SensitiveAuditPayloadDisclosureError,
} from "./query/sensitiveAuditPayloadDisclosure.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  targetEventId: EventId;
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | UnauthorizedError
  | AuditEventNotFound
  | AuditPayloadNotSensitive
  | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<SensitiveAuditPayload, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  sensitiveAuditPayloadDisclosure: SensitiveAuditPayloadDisclosure;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type RevealSensitiveAuditPayloadUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureAdmin = (user: User): Result<Admin, UnauthorizedError> =>
  user.kind === "Admin"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });

const toUseCaseRepositoryError = (
  error: RepositoryError,
): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});

const toUseCaseDisclosureError = (
  error: SensitiveAuditPayloadDisclosureError,
): AuditEventNotFound | AuditPayloadNotSensitive | UseCaseRepositoryError =>
  error.kind === "RepositoryError"
    ? toUseCaseRepositoryError(error)
    : error;

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toUseCaseRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureAdmin)
      .map((admin) =>
        createSensitiveAuditPayloadViewed(
          {
            eventId: dependencies.eventIdGenerator.generate(),
            occurredAt: dependencies.clock.now(),
            actorUserId: admin.userId,
          },
          input.targetEventId,
        ),
      )
      .andThen((viewedEvent) =>
        dependencies.sensitiveAuditPayloadDisclosure
          .revealAndRecord(input.targetEventId, viewedEvent)
          .mapErr(toUseCaseDisclosureError),
      );

export const RevealSensitiveAuditPayloadUseCase = {
  create: (dependencies: Dependencies): RevealSensitiveAuditPayloadUseCase => ({
    run: run(dependencies),
  }),
} as const;
