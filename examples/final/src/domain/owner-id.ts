import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const OwnerIdBrand = Symbol();
const OwnerIdSchema = z.string().uuid().brand<typeof OwnerIdBrand>();

export type OwnerId = z.infer<typeof OwnerIdSchema>;

export const OwnerId = {
  schema: OwnerIdSchema,
  parse: schemaResult(OwnerIdSchema),
} as const;
