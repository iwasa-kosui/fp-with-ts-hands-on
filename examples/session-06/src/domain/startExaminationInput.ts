import { ok, type Result } from "neverthrow";
import { z } from "zod";

import type { SchemaValidationError } from "./shared/schemaResult.js";

const StartExaminationInputSchema = z
  .object({
    appointmentId: z.string().uuid(),
    veterinarianId: z.string().uuid(),
    startedAt: z.string().datetime({ offset: true }),
  })
  .readonly();

export type StartExaminationInput = z.output<typeof StartExaminationInputSchema>;

export type StartExaminationInputResult = Result<
  StartExaminationInput,
  SchemaValidationError
>;

export const StartExaminationInput = {
  parse: (_raw: unknown): StartExaminationInputResult =>
    ok({ appointmentId: "", veterinarianId: "", startedAt: "" }),
} as const;
