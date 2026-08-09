import { z } from "zod";

import { schemaResult } from "../shared/schemaResult.js";

const AppointmentVersionSchema = z.number().int().positive().brand<"AppointmentVersion">();

export type AppointmentVersion = z.infer<typeof AppointmentVersionSchema>;

export const AppointmentVersion = {
  schema: AppointmentVersionSchema,
  parse: schemaResult(AppointmentVersionSchema),
} as const;
