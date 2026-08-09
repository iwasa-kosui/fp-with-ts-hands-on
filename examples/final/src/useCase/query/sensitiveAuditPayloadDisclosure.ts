import type { ResultAsync } from "neverthrow";

import type { SensitiveAuditPayloadViewed } from "../../domain/aggregate/auditEvent.js";
import type { EventId } from "../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";

export type SensitiveAuditPayload = Readonly<{
  aggregateState: unknown | null;
  eventPayload: Readonly<Record<string, unknown>>;
}>;

export type AuditEventNotFound = Readonly<{
  kind: "AuditEventNotFound";
  eventId: EventId;
}>;

export type AuditPayloadNotSensitive = Readonly<{
  kind: "AuditPayloadNotSensitive";
  eventId: EventId;
}>;

export type SensitiveAuditPayloadDisclosureError =
  | RepositoryError
  | AuditEventNotFound
  | AuditPayloadNotSensitive;

export type SensitiveAuditPayloadDisclosure = Readonly<{
  revealAndRecord: (
    targetEventId: EventId,
    viewedEvent: SensitiveAuditPayloadViewed,
  ) => ResultAsync<
    SensitiveAuditPayload,
    SensitiveAuditPayloadDisclosureError
  >;
}>;
