import { z } from "zod";

import { AppointmentId } from "./appointmentId.js";
import { schemaResult } from "./shared/schemaResult.js";
import { Timestamp } from "./timestamp.js";
import { VeterinarianId } from "./veterinarianId.js";

const StartExaminationInputSchema = z
  .object({
    appointmentId: AppointmentId.schema,
    veterinarianId: VeterinarianId.schema,
    startedAt: Timestamp.schema,
  })
  .readonly();

export type StartExaminationInput = z.output<typeof StartExaminationInputSchema>;

export const StartExaminationInput = {
  parse: schemaResult(StartExaminationInputSchema),
} as const;
