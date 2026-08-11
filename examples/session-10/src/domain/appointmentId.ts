import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const AppointmentIdSchema = z.string().uuid().brand<"AppointmentId">();

export type AppointmentId = z.output<typeof AppointmentIdSchema>;

export const AppointmentId = {
  schema: AppointmentIdSchema,
  parse: schemaResult(AppointmentIdSchema),
} as const;
