import type { AnyDomainEvent } from "../../../domain/aggregate/domainEvent.js";
import { Sensitive } from "../../../domain/shared/sensitive.js";

export type PayloadSensitivity = "Regular" | "Sensitive";

type AuditJsonPrimitive = string | number | boolean | null;
export type AuditJsonValue =
  | AuditJsonPrimitive
  | readonly AuditJsonValue[]
  | { readonly [key: string]: AuditJsonValue };

const regularEventNames = new Set<string>();

export const classifyPayloadSensitivity = (
  eventName: string,
): PayloadSensitivity =>
  regularEventNames.has(eventName) ? "Regular" : "Sensitive";

const isPlainObject = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const toAuditJsonValue = (value: unknown): AuditJsonValue => {
  if (Sensitive.is(value)) return toAuditJsonValue(value.unwrap());
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
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new TypeError("Audit JSON cannot contain symbol keys");
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toAuditJsonValue(item)]),
    );
  }
  throw new TypeError(`Audit JSON cannot contain ${typeof value}`);
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
  eventPayload: Object.fromEntries(
    Object.entries(event.eventPayload).map(([key, value]) => [
      key,
      toAuditJsonValue(value),
    ]),
  ),
});
