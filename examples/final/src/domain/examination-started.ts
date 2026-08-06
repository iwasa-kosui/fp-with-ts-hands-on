import type { AppointmentId } from "./appointment-id.js";
import type { EventId } from "./event-id.js";
import type { Timestamp } from "./timestamp.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type ExaminationStarted = Readonly<{
  kind: "ExaminationStarted";
  eventId: EventId;
  occurredAt: Timestamp;
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export type CreateExaminationStartedInput = Readonly<Omit<ExaminationStarted, "kind">>;

export const ExaminationStarted = {
  create: (input: CreateExaminationStartedInput): ExaminationStarted => ({
    kind: "ExaminationStarted",
    ...input,
  }),
} as const;
