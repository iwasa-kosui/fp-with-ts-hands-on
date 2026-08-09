import type { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { SensitiveAuditPayloadViewed } from "../../domain/aggregate/auditEvent.js";
import type { EventId } from "../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import {
  AuditJsonObject,
  AuditJsonValue,
} from "../../domain/shared/auditJson.js";
import { schemaResult } from "../../domain/shared/schemaResult.js";

const SensitiveAuditPayloadSchema = z.object({
  aggregateState: AuditJsonValue.schema,
  eventPayload: AuditJsonObject.schema,
}).strict();

export type SensitiveAuditPayload = Readonly<
  z.infer<typeof SensitiveAuditPayloadSchema>
>;

export const SensitiveAuditPayload = {
  schema: SensitiveAuditPayloadSchema,
  parse: schemaResult(SensitiveAuditPayloadSchema),
} as const;

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
