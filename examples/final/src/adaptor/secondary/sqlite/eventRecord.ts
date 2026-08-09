import type { AnyDomainEvent } from "../../../domain/aggregate/domainEvent.js";
import { Sensitive } from "../../../domain/shared/sensitive.js";

export type PayloadSensitivity = "Regular" | "Sensitive";

type AuditJsonPrimitive = string | number | boolean | null;
type AuditJsonObject = { readonly [key: string]: AuditJsonValue };
export type AuditJsonValue =
  | AuditJsonPrimitive
  | readonly AuditJsonValue[]
  | AuditJsonObject;

const regularEventNames = new Set<string>([
  "audit.sensitive-payload-viewed",
]);

export const classifyPayloadSensitivity = (
  eventName: string,
): PayloadSensitivity =>
  regularEventNames.has(eventName) ? "Regular" : "Sensitive";

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isAuditJsonObject = (value: AuditJsonValue): value is AuditJsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const toAuditJsonValue = (value: unknown): AuditJsonValue => {
  if (Sensitive.is(value)) return toAuditJsonValue(value.unwrap());
  if (
    typeof value === "object" &&
    value !== null &&
    Object.getOwnPropertySymbols(value).length > 0
  ) {
    throw new TypeError("Audit JSON cannot contain symbol keys");
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Audit JSON cannot contain a non-finite number");
    return value;
  }
  if (Array.isArray(value)) return value.map(toAuditJsonValue);
  if (typeof value === "object") {
    if (!isPlainObject(value)) throw new TypeError("Audit JSON requires a plain object");
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toAuditJsonValue(item)]),
    );
  }
  throw new TypeError(`Audit JSON cannot contain ${typeof value}`);
};

const toAuditJsonObject = (value: unknown): AuditJsonObject => {
  const serialized = toAuditJsonValue(value);
  if (!isAuditJsonObject(serialized)) {
    throw new TypeError("Audit event payload requires a plain object");
  }
  return serialized;
};

export type EventRecord = Readonly<{
  metadata: Readonly<{
    eventId: string;
    aggregateId: string;
    aggregateName: string;
    eventName: string;
    occurredAt: string;
    actorUserId: string;
    payloadSensitivity: PayloadSensitivity;
  }>;
  aggregateState: AuditJsonValue;
  eventPayload: Readonly<Record<string, AuditJsonValue>>;
}>;

export const toEventRecord = (event: AnyDomainEvent): EventRecord => ({
  metadata: {
    eventId: String(event.eventId),
    aggregateId: String(event.aggregateId),
    aggregateName: event.aggregateName,
    eventName: event.eventName,
    occurredAt: String(event.occurredAt),
    actorUserId: String(event.actorUserId),
    payloadSensitivity: classifyPayloadSensitivity(event.eventName),
  },
  aggregateState: toAuditJsonValue(event.aggregateState ?? null),
  eventPayload: toAuditJsonObject(event.eventPayload),
});
