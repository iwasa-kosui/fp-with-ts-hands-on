import type { Appointment, InExamination, Scheduled } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { AppointmentResolver } from "../useCase/dependencies.js";

export type AppointmentStore = AppointmentResolver & Readonly<{
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
  };
};
