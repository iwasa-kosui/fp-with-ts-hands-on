import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";

const AppointmentReasonBrand = Symbol();
const AppointmentReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .brand<typeof AppointmentReasonBrand>()
  .transform(Sensitive.of);

export type AppointmentReason = z.infer<typeof AppointmentReasonSchema>;

export const AppointmentReason = {
  schema: AppointmentReasonSchema,
  parse: schemaResult(AppointmentReasonSchema),
} as const;
