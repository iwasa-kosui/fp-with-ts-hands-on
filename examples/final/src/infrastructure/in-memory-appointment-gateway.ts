import { err, ok } from "neverthrow";

import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import type { ClinicDomainEvent } from "../domain/clinic-domain-event.js";
import type { AppointmentResolver, RepositoryError } from "../ports/appointment-resolver.js";
import type { AppointmentStore } from "../ports/appointment-store.js";

type SaveCall = Readonly<{
  state: Appointment;
  events: ReadonlyArray<ClinicDomainEvent>;
}>;

export type InMemoryAppointmentGateway = Readonly<{
  resolver: AppointmentResolver;
  store: AppointmentStore;
  appointments: () => ReadonlyArray<Appointment>;
  events: () => ReadonlyArray<ClinicDomainEvent>;
  saveCalls: () => ReadonlyArray<SaveCall>;
}>;

export const createInMemoryAppointmentGateway = (
  initialAppointments: ReadonlyArray<Appointment>,
  saveFailure?: RepositoryError,
): InMemoryAppointmentGateway => {
  let states = new Map<AppointmentId, Appointment>(
    initialAppointments.map((appointment) => [appointment.appointmentId, appointment]),
  );
  let savedEvents: ReadonlyArray<ClinicDomainEvent> = [];
  let recordedSaveCalls: ReadonlyArray<SaveCall> = [];

  const resolver: AppointmentResolver = {
    findById: (appointmentId) => ok(states.get(appointmentId)),
  };

  const store: AppointmentStore = {
    save: (state, events) => {
      recordedSaveCalls = [...recordedSaveCalls, { state, events }];
      if (saveFailure !== undefined) {
        return err(saveFailure);
      }

      const nextStates = new Map(states);
      nextStates.set(state.appointmentId, state);
      const nextEvents = [...savedEvents, ...events];

      states = nextStates;
      savedEvents = nextEvents;
      return ok(undefined);
    },
  };

  return {
    resolver,
    store,
    appointments: () => [...states.values()],
    events: () => savedEvents,
    saveCalls: () => recordedSaveCalls,
  };
};
