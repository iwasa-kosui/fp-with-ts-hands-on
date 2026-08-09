import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const OwnerIdBrand = Symbol();
const OwnerIdSchema = z.string().uuid().brand<typeof OwnerIdBrand>();

export type OwnerId = z.infer<typeof OwnerIdSchema>;

export const OwnerId = {
  schema: OwnerIdSchema,
  parse: schemaResult(OwnerIdSchema),
} as const;
