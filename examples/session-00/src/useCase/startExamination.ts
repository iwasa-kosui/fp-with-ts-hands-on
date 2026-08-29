import { randomUUID } from "node:crypto";

import {
  RESERVED_AUDIT_EVENT_ID,
  type AppointmentRepository,
} from "../adaptor/secondary/sqlite/appointmentRepository.js";
import {
  updateStatus,
  type Appointment,
} from "../domain/appointment/appointment.js";

type Input = Readonly<{
  appointmentId: string;
  veterinarianId: string;
}>;

const run =
  (repository: AppointmentRepository, eventId: string) =>
  (input: Input): Appointment => {
    const current = repository.find(input.appointmentId);

    if (current === undefined) {
      throw new Error(`Appointment not found: ${input.appointmentId}`);
    }

    const occurredAt = new Date().toISOString();
    const updated = updateStatus(current, "in-examination", {
      veterinarianId: input.veterinarianId,
      examinationStartedAt: occurredAt,
    });

    repository.save(updated);
    repository.appendAudit({
      eventId,
      eventName: "examination.started",
      occurredAt,
      appointment: updated,
    });

    return updated;
  };

export const startExamination =
  (repository: AppointmentRepository) =>
  (input: Input): Appointment =>
    run(repository, randomUUID())(input);

export const startExaminationWithAuditFailure =
  (repository: AppointmentRepository) =>
  (input: Input): Appointment =>
    run(repository, RESERVED_AUDIT_EVENT_ID)(input);
