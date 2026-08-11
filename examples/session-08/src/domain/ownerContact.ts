import { ok, type Result } from "neverthrow";

import type { OwnerId } from "./ownerId.js";
import type { SchemaValidationError } from "./shared/schemaResult.js";

export type OwnerContactInput = Readonly<{
  ownerId: OwnerId;
  ownerPhone: string;
}>;

export type OwnerContact = OwnerContactInput;

export const OwnerContact = {
  parse: (raw: OwnerContactInput): Result<OwnerContact, SchemaValidationError> => ok(raw),
} as const;
