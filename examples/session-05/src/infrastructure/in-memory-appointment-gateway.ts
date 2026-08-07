import { ok, type Result } from "neverthrow";

import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import type { ClinicDomainEvent } from "../domain/clinic-domain-event.js";
import type {
  AppointmentResolver,
  RepositoryError,
} from "../ports/appointment-resolver.js";
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
): InMemoryAppointmentGateway => {
  let appointments = new Map<AppointmentId, Appointment>();
  initialAppointments.forEach((appointment) => {
    appointments.set(appointment.appointmentId, appointment);
  });
  let events: ReadonlyArray<ClinicDomainEvent> = [];
  const saveCalls: Array<SaveCall> = [];

  const resolver: AppointmentResolver = {
    findById: (appointmentId): Result<Appointment | undefined, RepositoryError> =>
      ok(appointments.get(appointmentId)),
  };

  const store: AppointmentStore = {
    save: (state, newEvents) => {
      const nextAppointments = new Map(appointments);
      nextAppointments.set(state.appointmentId, state);
      const nextEvents = [...events, ...newEvents];

      appointments = nextAppointments;
      events = nextEvents;
      saveCalls.push({ state, events: [...newEvents] });
      return ok(undefined);
    },
  };

  return {
    resolver,
    store,
    appointments: () => [...appointments.values()],
    events: () => [...events],
    saveCalls: () => [...saveCalls],
  };
};
