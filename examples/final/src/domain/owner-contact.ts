import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";
import { Sensitive } from "../shared/sensitive.js";
import { OwnerEmail } from "./owner-email.js";
import { OwnerName } from "./owner-name.js";
import { OwnerPhone } from "./owner-phone.js";

const OwnerContactSchema = z.object({
  ownerName: OwnerName.schema.transform(Sensitive.of),
  ownerEmail: OwnerEmail.schema.transform(Sensitive.of),
  ownerPhone: OwnerPhone.schema.transform(Sensitive.of),
}).readonly();

export type OwnerContact = Readonly<z.infer<typeof OwnerContactSchema>>;

export const OwnerContact = {
  schema: OwnerContactSchema,
  parse: schemaResult(OwnerContactSchema),
} as const;
