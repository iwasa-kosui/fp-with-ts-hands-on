import type {
  AppointmentId,
  InExamination,
  VeterinarianId,
} from "../../../src/domain/appointment/index.js";

type ExaminationStartedAuditPayload = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const toAuditPayload = ({
  appointmentId,
  veterinarianId,
  examinationStartedAt,
}: InExamination): ExaminationStartedAuditPayload => ({
  appointmentId,
  veterinarianId,
  examinationStartedAt,
});
