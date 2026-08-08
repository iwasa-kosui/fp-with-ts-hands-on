import { asc } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  EventHistoryReader,
  SanitizedAuditRecord,
  SanitizedAuditValue,
} from "../../../../useCase/query/eventHistoryReader.js";
import type { SqliteDatabase } from "../db.js";
import { domainEventsTable } from "../schema.js";
import {
  parsePersistedEventRow,
  type PersistedEventRow,
} from "./persistedEventRow.js";

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

const sanitizeValue = (key: string, value: unknown): SanitizedAuditValue =>
  safeKeys.has(key) &&
  (typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null)
    ? value
    : redacted;

const sanitizeRecord = (
  value: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, SanitizedAuditValue>> | undefined =>
  value === null
    ? undefined
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          sanitizeValue(key, item),
        ]),
      );

const toSanitizedAuditRecord = (
  row: PersistedEventRow,
): SanitizedAuditRecord => ({
  eventId: row.eventId,
  aggregateId: row.aggregateId,
  aggregateName: row.aggregateName,
  aggregateState: sanitizeRecord(row.aggregateState),
  eventName: row.eventName,
  eventPayload: sanitizeRecord(row.eventPayload) ?? {},
  occurredAt: row.occurredAt,
  actorUserId: row.actorUserId,
});

export const createEventHistoryReader = (
  db: SqliteDatabase,
): EventHistoryReader => ({
  list: (_admin) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select()
          .from(domainEventsTable)
          .orderBy(asc(domainEventsTable.occurredAt))
          .all()
          .map(parsePersistedEventRow)
          .map(toSanitizedAuditRecord),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "EventHistoryReader.list",
        cause,
      }),
    ),
});
