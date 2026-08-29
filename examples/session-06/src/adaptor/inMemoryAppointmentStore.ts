import { err, ok, ResultAsync } from "neverthrow";

import type { Appointment, InExamination, Scheduled } from "../domain/appointment/index.js";
import type { ExaminationStarted } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";
import type { AppointmentResolver } from "../useCase/dependencies.js";
import type { AppointmentConflict } from "../useCase/errors.js";

export type AppointmentStore = AppointmentResolver & Readonly<{
  atomicStore: Readonly<{
    store: (
      event: ExaminationStarted,
    ) => ResultAsync<void, AppointmentConflict>;
  }>;
  eventLog: Readonly<{ append: (event: ExaminationStarted) => Promise<void> }>;
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
  stateStore: Readonly<{ save: (appointment: InExamination) => Promise<void> }>;
}>;

export const createInMemoryAppointmentStore = (
  initial: Scheduled,
  options: Readonly<{ failEventLog?: boolean }> = {},
): AppointmentStore => {
  let appointment: Appointment = initial;
  let events: ReadonlyArray<ExaminationStarted> = [];
  const find = (appointmentId: string | AppointmentId) =>
    appointment.appointmentId === appointmentId ? appointment : undefined;

  return {
    find,
    resolveById: find,
    reset: () => {
      appointment = initial;
      events = [];
      return initial;
    },
    save: (next) => {
      appointment = next;
    },
    stateStore: {
      save: async (next) => {
        appointment = next;
      },
    },
    eventLog: {
      append: async (event) => {
        if (options.failEventLog === true) throw new Error("Event log unavailable");
        events = [...events, event];
      },
    },
    atomicStore: {
      store: (event) => ResultAsync.fromSafePromise(
        (async () => {
          if (options.failEventLog === true) {
            throw new Error("Event store unavailable");
          }
          const current = find(event.appointmentId);
          if (current === undefined || current.kind !== "CheckedIn") {
            return err({
              kind: "AppointmentConflict",
              appointmentId: event.appointmentId,
            } as const);
          }
          appointment = event.aggregateState;
          events = [...events, event];
          return ok(undefined);
        })(),
      ).andThen((result) => result),
    },
  };
};
