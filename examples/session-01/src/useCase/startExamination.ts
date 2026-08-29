import { randomUUID } from "node:crypto";

import type { AppointmentRepository } from "../adaptor/secondary/sqlite/appointmentRepository.js";
import {
  updateStatus,
  type Appointment,
} from "../domain/appointment/appointment.js";

type Input = Readonly<{
  appointmentId: string;
  veterinarianId: string;
}>;

export const startExamination =
  (repository: AppointmentRepository) =>
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
      eventId: randomUUID(),
      eventName: "examination.started",
      occurredAt,
      appointment: updated,
    });

    return updated;
  };
