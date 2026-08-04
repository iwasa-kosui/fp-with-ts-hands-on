import type { AppointmentId } from "./appointment-id.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type ExaminationStarted = Readonly<{
  kind: "ExaminationStarted";
  eventId: string;
  occurredAt: string;
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;
export type FollowUpRequested = Readonly<{
  kind: "FollowUpRequested";
  eventId: string;
  occurredAt: string;
  appointmentId: AppointmentId;
}>;
export type ClinicDomainEvent = ExaminationStarted | FollowUpRequested;

export const ExaminationStarted: Readonly<{
  create: (input: Omit<ExaminationStarted, "kind">) => ExaminationStarted;
}> = { create: (input) => ({ kind: "ExaminationStarted", ...input }) };

export const FollowUpRequested: Readonly<{
  create: (input: Omit<FollowUpRequested, "kind">) => FollowUpRequested;
}> = { create: (input) => ({ kind: "FollowUpRequested", ...input }) };
