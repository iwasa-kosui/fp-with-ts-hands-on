import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

export const OwnerIdBrand = Symbol();

const OwnerIdSchema = z.string().uuid().brand<typeof OwnerIdBrand>();

export type OwnerId = z.infer<typeof OwnerIdSchema>;

export const OwnerId = {
  schema: OwnerIdSchema,
  parse: schemaResult<OwnerId>(OwnerIdSchema),
} as const;
