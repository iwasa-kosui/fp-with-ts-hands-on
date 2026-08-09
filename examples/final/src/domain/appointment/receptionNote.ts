import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const ReceptionNoteSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .brand<"ReceptionNote">()
  .transform(Sensitive.of);

export type ReceptionNote = z.infer<typeof ReceptionNoteSchema>;

export const ReceptionNote = {
  schema: ReceptionNoteSchema,
  parse: schemaResult(ReceptionNoteSchema),
} as const;
