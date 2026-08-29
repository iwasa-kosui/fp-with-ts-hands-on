import { randomUUID } from "node:crypto";

import {
  RESERVED_AUDIT_EVENT_ID,
  type AppointmentStore,
} from "../adaptor/secondary/sqlite/appointmentStore.js";
import {
  updateStatus,
  type Appointment,
} from "../domain/appointment/appointment.js";

type Input = Readonly<{
  appointmentId: string;
  veterinarianId: string;
}>;

const run = (store: AppointmentStore, eventId: string) => (input: Input): Appointment => {
  const current = store.find(input.appointmentId);

  if (current === undefined) {
    throw new Error(`Appointment not found: ${input.appointmentId}`);
  }

  const occurredAt = new Date().toISOString();
  const updated = updateStatus(current, "in-examination", {
    veterinarianId: input.veterinarianId,
    examinationStartedAt: occurredAt,
  });

  store.save(updated);
  store.appendAudit({
    eventId,
    eventName: "examination.started",
    occurredAt,
    appointment: updated,
  });

  return updated;
};

export const startExamination = (store: AppointmentStore) =>
  (input: Input): Appointment => run(store, randomUUID())(input);

export const startExaminationWithAuditFailure = (store: AppointmentStore) =>
  (input: Input): Appointment => run(store, RESERVED_AUDIT_EVENT_ID)(input);
