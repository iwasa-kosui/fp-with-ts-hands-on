import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const AppointmentDurationSchema = z.union([
  z.literal(15),
  z.literal(30),
  z.literal(45),
  z.literal(60),
]);

export type AppointmentDuration = z.infer<typeof AppointmentDurationSchema>;

export const AppointmentDuration = {
  schema: AppointmentDurationSchema,
  parse: schemaResult(AppointmentDurationSchema),
} as const;
