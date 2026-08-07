import { z } from "zod";

import { schemaResult } from "../shared/schema-result.js";
import { AppointmentId } from "../domain/appointment-id.js";
import { EventId } from "../domain/event-id.js";
import { Timestamp } from "../domain/timestamp.js";
import { VeterinarianId } from "../domain/veterinarian-id.js";

const StartExaminationInputSchema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
  eventId: EventId.schema,
  occurredAt: Timestamp.schema,
}).readonly();

export type StartExaminationInput = Readonly<z.infer<typeof StartExaminationInputSchema>>;

export const StartExaminationInput = {
  schema: StartExaminationInputSchema,
  parse: schemaResult(StartExaminationInputSchema),
} as const;
