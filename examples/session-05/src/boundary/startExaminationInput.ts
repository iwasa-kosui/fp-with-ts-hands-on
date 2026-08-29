import { z } from "zod";

import { AppointmentId } from "../domain/ids/appointmentId.js";
import { VeterinarianId } from "../domain/ids/veterinarianId.js";
import { schemaResult } from "../shared/schemaResult.js";

const schema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
}).readonly();

export type StartExaminationInput = z.infer<typeof schema>;

export const StartExaminationInput = {
  schema,
  parse: schemaResult(schema),
} as const;

