import type { AppointmentId } from "./appointment-id.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type ExaminationStarted = Readonly<{
  kind: "ExaminationStarted";
  eventId: string;
  occurredAt: string;
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export const ExaminationStarted = {
  create: (input: Omit<ExaminationStarted, "kind">): ExaminationStarted => ({
    kind: "ExaminationStarted",
    ...input,
  }),
} as const;
