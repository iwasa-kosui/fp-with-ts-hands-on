import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { EventId } from "../domain/aggregate/eventId.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../domain/aggregate/timestamp.js";
import type { User, Admin } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type {
  EventHistoryEntry,
  EventHistoryReader,
} from "./query/eventHistoryReader.js";

const redacted = "[REDACTED]";
const safeKeys = new Set([
  "kind",
  "role",
  "userId",
  "veterinarianId",
  "sessionId",
  "expiresAt",
  "ownerId",
  "petId",
  "species",
  "appointmentId",
  "scheduledAt",
  "checkedInAt",
  "examinationStartedAt",
  "amount",
  "paidAt",
  "canceledAt",
  "examId",
  "collectedAt",
  "needsFollowUp",
]);

export type EventView = Readonly<{
  eventId: EventId;
  aggregateId: string;
  aggregateName: string;
  eventName: string;
  occurredAt: Timestamp;
  actorUserId: UserId;
  aggregateState: Readonly<Record<string, unknown>> | undefined;
  eventPayload: Readonly<Record<string, unknown>>;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ events: readonly EventView[] }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  eventHistoryReader: EventHistoryReader;
}>;
export type ListEventsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureAdmin = (user: User): Result<Admin, UnauthorizedError> =>
  user.kind === "Admin"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const sanitizeValue = (key: string, value: unknown): unknown => {
  if (!safeKeys.has(key)) return redacted;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return redacted;
};
const sanitizeRecord = (
  value: unknown,
): Readonly<Record<string, unknown>> | undefined =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          sanitizeValue(key, item),
        ]),
      )
    : undefined;
const toView = (event: EventHistoryEntry): EventView => ({
  eventId: event.eventId,
  aggregateId:
    typeof event.aggregateId === "string" ? event.aggregateId : redacted,
  aggregateName: event.aggregateName,
  eventName: event.eventName,
  occurredAt: event.occurredAt,
  actorUserId: event.actorUserId,
  aggregateState: sanitizeRecord(event.aggregateState),
  eventPayload: sanitizeRecord(event.eventPayload) ?? {},
});
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureAdmin)
      .andThen(() =>
        dependencies.eventHistoryReader.list().mapErr(toRepositoryError),
      )
      .map((events) => ({ events: events.map(toView) }));

export const ListEventsUseCase = {
  create: (dependencies: Dependencies): ListEventsUseCase => ({
    run: run(dependencies),
  }),
} as const;
