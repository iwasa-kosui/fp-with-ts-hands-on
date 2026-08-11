import { okAsync, type ResultAsync } from "neverthrow";

import type { Appointment } from "../domain/appointment.js";
import type { AppointmentExaminationStarted } from "../domain/appointmentExaminationStarted.js";
import type { AppointmentId } from "../domain/appointmentId.js";
import type {
  AppointmentStoreError,
  ExaminationStartedStore,
} from "../domain/appointmentStores.js";

export type InMemoryAppointmentEventStore = ExaminationStartedStore &
  Readonly<{
    currentState: (appointmentId: AppointmentId) => Appointment | undefined;
    events: () => readonly AppointmentExaminationStarted[];
  }>;

const store = (
  _event: AppointmentExaminationStarted,
): ResultAsync<void, AppointmentStoreError> => okAsync(undefined);

export const InMemoryAppointmentEventStore = {
  create: (
    appointments: readonly Appointment[],
  ): InMemoryAppointmentEventStore => ({
    store,
    currentState: (appointmentId) =>
      appointments.find((appointment) => appointment.appointmentId === appointmentId),
    events: () => [],
  }),
} as const;
