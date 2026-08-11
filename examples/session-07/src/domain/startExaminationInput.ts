import { z } from "zod";

import { schemaResult } from "./shared/schemaResult.js";

const StartExaminationInputSchema = z
  .object({
    appointmentId: z.string().uuid(),
    veterinarianId: z.string().uuid(),
    startedAt: z.string().datetime({ offset: true }),
  })
  .readonly();

export type StartExaminationInput = z.output<typeof StartExaminationInputSchema>;

export const StartExaminationInput = {
  parse: schemaResult(StartExaminationInputSchema),
} as const;
