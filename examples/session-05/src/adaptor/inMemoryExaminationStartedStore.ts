import { ResultAsync } from "neverthrow";

import type { Appointment } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type {
  AppointmentResolver,
  ExaminationStartedStore,
} from "../useCase/dependencies.js";

export type InMemoryExaminationStartedStore = Readonly<{
  resolver: AppointmentResolver;
  store: ExaminationStartedStore;
  appointments: () => ReadonlyArray<Appointment>;
  events: () => ReadonlyArray<ExaminationStarted>;
  storeCalls: () => number;
}>;

export type InMemoryStoreOptions = Readonly<{
  beforeCommit?: (event: ExaminationStarted) => Promise<void>;
}>;

export const createInMemoryExaminationStartedStore = (
  initialAppointments: ReadonlyArray<Appointment>,
  options: InMemoryStoreOptions = {},
): InMemoryExaminationStartedStore => {
  let appointments = new Map<AppointmentId, Appointment>(
    initialAppointments.map((appointment) => [
      appointment.appointmentId,
      appointment,
    ]),
  );
  let events: ReadonlyArray<ExaminationStarted> = [];
  let storeCalls = 0;

  const resolver: AppointmentResolver = {
    resolveById: (appointmentId) => appointments.get(appointmentId),
  };

  const store: ExaminationStartedStore = {
    store: (event) => {
      storeCalls += 1;
      return ResultAsync.fromPromise(
        (async () => {
          await options.beforeCommit?.(event);
          const nextAppointments = new Map(appointments);
          nextAppointments.set(event.appointmentId, event.aggregateState);
          const nextEvents = [...events, event];

          appointments = nextAppointments;
          events = nextEvents;
        })(),
        (cause) => ({
          kind: "RepositoryFailure",
          operation: "ExaminationStartedStore.store",
          cause,
        }),
      );
    },
  };

  return {
    resolver,
    store,
    appointments: () => [...appointments.values()],
    events: () => [...events],
    storeCalls: () => storeCalls,
  };
};
