import { z } from "zod";

import { schemaResult } from "./schemaResult.js";

type AuditJsonPrimitive = string | number | boolean | null;
export type AuditJsonObject = {
  readonly [key: string]: AuditJsonValue;
};
export type AuditJsonValue =
  | AuditJsonPrimitive
  | readonly AuditJsonValue[]
  | AuditJsonObject;

const hasJsonObjectPrototype = (value: object): boolean => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasOnlyExpectedOwnNames = (
  value: object,
  expectedNames: readonly string[],
): boolean => {
  const ownNames = Object.getOwnPropertyNames(value);
  return ownNames.length === expectedNames.length &&
    ownNames.every((name, index) => name === expectedNames[index]);
};

const hasJsonDataProperty = (
  value: object,
  key: string,
  ancestors: WeakSet<object>,
): boolean => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined &&
    descriptor.enumerable === true &&
    "value" in descriptor &&
    isAuditJsonValueInternal(descriptor.value, ancestors);
};

const isAuditJsonArray = (
  value: readonly unknown[],
  ancestors: WeakSet<object>,
): value is readonly AuditJsonValue[] => {
  if (
    Object.getPrototypeOf(value) !== Array.prototype ||
    Object.getOwnPropertySymbols(value).length > 0
  ) return false;
  const itemNames = Array.from(
    { length: value.length },
    (_, index) => String(index),
  );
  if (!hasOnlyExpectedOwnNames(value, [...itemNames, "length"])) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = itemNames.every((key) =>
    hasJsonDataProperty(value, key, ancestors)
  );
  ancestors.delete(value);
  return valid;
};

const isAuditJsonObjectInternal = (
  value: object,
  ancestors: WeakSet<object>,
): value is AuditJsonObject => {
  if (
    !hasJsonObjectPrototype(value) ||
    Object.getOwnPropertySymbols(value).length > 0
  ) return false;
  const keys = Object.keys(value);
  if (!hasOnlyExpectedOwnNames(value, keys)) return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = keys.every((key) =>
    Object.hasOwn(value, key) && hasJsonDataProperty(value, key, ancestors)
  );
  ancestors.delete(value);
  return valid;
};

const isAuditJsonValueInternal = (
  value: unknown,
  ancestors: WeakSet<object>,
): value is AuditJsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return isAuditJsonArray(value, ancestors);
  return typeof value === "object" &&
    isAuditJsonObjectInternal(value, ancestors);
};

const isAuditJsonValue = (value: unknown): value is AuditJsonValue => {
  try {
    return isAuditJsonValueInternal(value, new WeakSet());
  } catch {
    return false;
  }
};

const isAuditJsonObject = (value: unknown): value is AuditJsonObject =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  isAuditJsonValue(value);

const AuditJsonValueSchema = z.custom<AuditJsonValue>(
  isAuditJsonValue,
  "Expected an identity-preserving JSON value",
);
const AuditJsonObjectSchema = z.custom<AuditJsonObject>(
  isAuditJsonObject,
  "Expected an identity-preserving JSON object",
);

export const AuditJsonValue = {
  schema: AuditJsonValueSchema,
  parse: schemaResult(AuditJsonValueSchema),
} as const;

export const AuditJsonObject = {
  schema: AuditJsonObjectSchema,
  parse: schemaResult(AuditJsonObjectSchema),
} as const;
