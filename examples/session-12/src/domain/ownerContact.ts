import { z } from "zod";

import { OwnerId, type OwnerId as OwnerIdValue } from "./ownerId.js";
import { schemaResult } from "./shared/schemaResult.js";
import { Sensitive } from "./shared/sensitive.js";

const OwnerPhoneSchema = z.string().trim().min(1).max(40).brand<"OwnerPhone">();
const OwnerContactSchema = z
  .object({
    ownerId: OwnerId.schema,
    ownerPhone: OwnerPhoneSchema.transform(Sensitive.of),
  })
  .readonly();

export type OwnerContactInput = Readonly<{
  ownerId: OwnerIdValue;
  ownerPhone: string;
}>;
export type OwnerContact = z.output<typeof OwnerContactSchema>;

export const OwnerContact = {
  parse: (raw: OwnerContactInput) => schemaResult(OwnerContactSchema)(raw),
} as const;
