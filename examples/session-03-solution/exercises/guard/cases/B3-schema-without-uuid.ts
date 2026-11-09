import { z } from "zod";

import { schemaResult } from "../../../src/domain/shared/schemaResult.js";

const schema = z.object({
  appointmentId: z.string().brand<"AppointmentId">(),
  veterinarianId: z.string().brand<"VeterinarianId">(),
}).readonly();

export type StartExaminationInput = z.infer<typeof schema>;

export const StartExaminationInput = {
  schema,
  parse: schemaResult(schema),
} as const;
