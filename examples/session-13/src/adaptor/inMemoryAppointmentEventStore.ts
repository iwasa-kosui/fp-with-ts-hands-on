import { errAsync, okAsync } from "neverthrow";

import type { Appointment, CheckedIn } from "../domain/appointment.js";
import type { AppointmentExaminationStarted } from "../domain/appointmentExaminationStarted.js";
import type { AppointmentId } from "../domain/appointmentId.js";
import type { ExaminationStartedStore } from "../domain/appointmentStores.js";

export type InMemoryAppointmentEventStore = ExaminationStartedStore &
  Readonly<{
    currentState: (appointmentId: AppointmentId) => Appointment | undefined;
    events: () => readonly AppointmentExaminationStarted[];
  }>;

const expectedCheckedIn = (
  event: AppointmentExaminationStarted,
): CheckedIn => ({
  kind: "CheckedIn",
  appointmentId: event.aggregateState.appointmentId,
  petId: event.aggregateState.petId,
  ownerId: event.aggregateState.ownerId,
  scheduledAt: event.aggregateState.scheduledAt,
  checkedInAt: event.aggregateState.checkedInAt,
});

const isExpectedState = (
  current: Appointment | undefined,
  expected: CheckedIn,
): current is CheckedIn =>
  current?.kind === "CheckedIn" &&
  current.appointmentId === expected.appointmentId &&
  current.petId === expected.petId &&
  current.ownerId === expected.ownerId &&
  current.scheduledAt === expected.scheduledAt &&
  current.checkedInAt === expected.checkedInAt;

const create = (
  initialAppointments: readonly Appointment[],
): InMemoryAppointmentEventStore => {
  let states = new Map(
    initialAppointments.map(
      (appointment) => [appointment.appointmentId, appointment] as const,
    ),
  );
  let storedEvents: readonly AppointmentExaminationStarted[] = [];

  return {
    store: (event) => {
      const expected = expectedCheckedIn(event);
      if (!isExpectedState(states.get(event.aggregateId), expected)) {
        return errAsync({
          kind: "AppointmentConflict",
          appointmentId: event.aggregateId,
        });
      }

      try {
        const stagedStates = new Map(states);
        const stagedEvents = [...storedEvents, event];
        stagedStates.set(event.aggregateId, event.aggregateState);

        states = stagedStates;
        storedEvents = stagedEvents;
        return okAsync(undefined);
      } catch (cause) {
        return errAsync({
          kind: "RepositoryError",
          operation: "InMemoryAppointmentEventStore.store",
          cause,
        });
      }
    },
    currentState: (appointmentId) => states.get(appointmentId),
    events: () => [...storedEvents],
  };
};

export const InMemoryAppointmentEventStore = { create } as const;
