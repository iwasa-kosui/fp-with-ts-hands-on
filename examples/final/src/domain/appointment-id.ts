import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";

const AppointmentIdBrand = Symbol();
const AppointmentIdSchema = z.string().uuid().brand<typeof AppointmentIdBrand>();

export type AppointmentId = z.infer<typeof AppointmentIdSchema>;

export const AppointmentId = {
  schema: AppointmentIdSchema,
  parse: schemaResult(AppointmentIdSchema),
} as const;
