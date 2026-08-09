import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { EventId } from "../../../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { SensitiveAuditPayload } from "../../../../useCase/query/sensitiveAuditPayloadDisclosure.js";
import type {
  AuditEventNotFound,
  AuditPayloadNotSensitive,
  SensitiveAuditPayloadDisclosure,
  SensitiveAuditPayloadDisclosureError,
} from "../../../../useCase/query/sensitiveAuditPayloadDisclosure.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import {
  domainEventSensitivePayloadsTable,
  domainEventsTable,
} from "../schema.js";

const AuditEventNotFoundSchema = z.object({
  kind: z.literal("AuditEventNotFound"),
  eventId: EventId.schema,
}).strict();
const AuditPayloadNotSensitiveSchema = z.object({
  kind: z.literal("AuditPayloadNotSensitive"),
  eventId: EventId.schema,
}).strict();
const toDisclosureError = (
  cause: unknown,
): SensitiveAuditPayloadDisclosureError => {
  const notFound = AuditEventNotFoundSchema.safeParse(cause);
  if (notFound.success) return notFound.data;
  const notSensitive = AuditPayloadNotSensitiveSchema.safeParse(cause);
  if (notSensitive.success) return notSensitive.data;
  return {
    kind: "RepositoryError",
    operation: "SensitiveAuditPayloadDisclosure.revealAndRecord",
    cause,
  } satisfies RepositoryError;
};

const readSensitivePayload = (
  db: Parameters<Parameters<SqliteDatabase["transaction"]>[0]>[0],
  targetEventId: EventId,
): SensitiveAuditPayload => {
  const metadata = db
    .select({ payloadSensitivity: domainEventsTable.payloadSensitivity })
    .from(domainEventsTable)
    .where(eq(domainEventsTable.eventId, targetEventId))
    .get();
  if (metadata === undefined) {
    throw {
      kind: "AuditEventNotFound",
      eventId: targetEventId,
    } satisfies AuditEventNotFound;
  }
  if (metadata.payloadSensitivity !== "Sensitive") {
    throw {
      kind: "AuditPayloadNotSensitive",
      eventId: targetEventId,
    } satisfies AuditPayloadNotSensitive;
  }
  const payload = db
    .select({
      aggregateState: domainEventSensitivePayloadsTable.aggregateState,
      eventPayload: domainEventSensitivePayloadsTable.eventPayload,
    })
    .from(domainEventSensitivePayloadsTable)
    .where(eq(domainEventSensitivePayloadsTable.eventId, targetEventId))
    .get();
  if (payload === undefined) {
    throw new TypeError("Corrupt sensitive domain event payload");
  }
  return SensitiveAuditPayload.parse(payload).match(
    (decoded) => decoded,
    () => {
      throw new TypeError("Corrupt sensitive domain event payload");
    },
  );
};

export const createSensitiveAuditPayloadDisclosure = (
  db: SqliteDatabase,
): SensitiveAuditPayloadDisclosure => ({
  revealAndRecord: (targetEventId, viewedEvent) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const payload = readSensitivePayload(tx, targetEventId);
          persistDomainEvent(tx, viewedEvent);
          return payload;
        }, { behavior: "immediate" }),
      ),
      toDisclosureError,
    ),
});
