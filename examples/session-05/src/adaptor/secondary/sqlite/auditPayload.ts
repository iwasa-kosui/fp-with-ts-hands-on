import type {
  AppointmentId,
  InExamination,
  VeterinarianId,
} from "../../../domain/appointment/index.js";

export type ExaminationStartedAuditPayload = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const toAuditPayload = (
  appointment: InExamination,
): ExaminationStartedAuditPayload => ({
  appointmentId: appointment.appointmentId,
  veterinarianId: appointment.veterinarianId,
  examinationStartedAt: appointment.examinationStartedAt,
});
