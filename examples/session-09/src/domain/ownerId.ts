import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const OwnerIdSchema = z.string().uuid().brand<"OwnerId">();

export type OwnerId = z.output<typeof OwnerIdSchema>;

export const OwnerId = {
  schema: OwnerIdSchema,
  parse: schemaResult(OwnerIdSchema),
} as const;
