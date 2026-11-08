import type { InExamination } from "../../../src/domain/appointment/index.js";
import { clinicFixture } from "../../../../fixtures/clinic.js";

export const toAuditPayload = (appointment: InExamination) => ({
  appointmentId: appointment.appointmentId,
  veterinarianId: appointment.veterinarianId,
  examinationStartedAt: appointment.examinationStartedAt,
  ownerContact: clinicFixture.ownerContact,
});
