import type { InExamination } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { DomainEvent } from "./domainEvent.js";
import type { VeterinarianId } from "./veterinarianId.js";

export type AppointmentExaminationStarted = DomainEvent<
  AppointmentId,
  "Appointment",
  InExamination,
  "AppointmentExaminationStarted",
  "appointment.examination-started",
  Readonly<{ appointmentId: AppointmentId; veterinarianId: VeterinarianId }>
>;
