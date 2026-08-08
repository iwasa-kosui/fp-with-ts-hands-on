import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { Appointment } from "../../../../domain/appointment/appointment.js";
import type { AppointmentEvent } from "../../../../domain/appointment/appointmentEvent.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { appointmentsTable, domainEventsTable } from "../schema.js";

const safeState = (state: Appointment): Readonly<Record<string, unknown>> => {
  const base = {
    kind: state.kind,
    appointmentId: state.appointmentId,
    ownerId: state.ownerId,
    petId: state.petId,
    scheduledAt: state.scheduledAt,
  };

  switch (state.kind) {
    case "Scheduled":
      return base;
    case "CheckedIn":
      return { ...base, checkedInAt: state.checkedInAt };
    case "InExamination":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
      };
    case "Paid":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        amount: state.amount,
        paidAt: state.paidAt,
      };
    case "Canceled":
      return { ...base, canceledAt: state.canceledAt };
    default:
      return state satisfies never;
  }
};

const safePayload = (event: AppointmentEvent): Readonly<Record<string, unknown>> => {
  switch (event.kind) {
    case "ExaminationStarted":
      return {
        appointmentId: event.aggregateId,
        veterinarianId: event.aggregateState.veterinarianId,
      };
    case "AppointmentBooked":
    case "AppointmentCheckedIn":
    case "PaymentRecorded":
    case "AppointmentCanceled":
      return { appointmentId: event.aggregateId };
    default:
      return event satisfies never;
  }
};

const projectionState = (state: Appointment): Readonly<Record<string, unknown>> => {
  const base = {
    kind: state.kind,
    appointmentId: state.appointmentId,
    ownerId: state.ownerId,
    petId: state.petId,
    scheduledAt: state.scheduledAt,
    reason: state.reason.unwrap(),
  };
  switch (state.kind) {
    case "Scheduled":
      return base;
    case "CheckedIn":
      return { ...base, checkedInAt: state.checkedInAt };
    case "InExamination":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
      };
    case "Paid":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        diagnosis: state.diagnosis.unwrap(),
        treatment: state.treatment.unwrap(),
        amount: state.amount,
        paidAt: state.paidAt,
      };
    case "Canceled":
      return { ...base, canceledAt: state.canceledAt };
    default:
      return state satisfies never;
  }
};

export const createAppointmentEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly AppointmentEvent[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            const state = event.aggregateState;
            const values = {
              appointmentId: state.appointmentId,
              status: state.kind,
              ownerId: state.ownerId,
              petId: state.petId,
              state: projectionState(state),
            };
            tx.insert(appointmentsTable)
              .values(values)
              .onConflictDoUpdate({ target: appointmentsTable.appointmentId, set: values })
              .run();
            tx.insert(domainEventsTable)
              .values(toEventRecord(
                event,
                safeState(state),
                safePayload(event),
              ))
              .run();
          });
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "AppointmentEventStore.store",
        cause,
      }),
    ),
} as const);
