import type { ResultAsync } from "neverthrow";
import type { AppointmentId } from "./appointmentId.js";
import type {
  AppointmentBooked,
  AppointmentCanceled,
  AppointmentCheckedIn,
  ExaminationStarted,
  PaymentRecorded,
} from "./appointmentEvent.js";

export type AppointmentConflict = Readonly<{
  kind: "AppointmentConflict";
  appointmentId: AppointmentId;
}>;
export type AppointmentStoreError = AppointmentConflict;
type AppointmentStore<TEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, AppointmentStoreError>;
}>;
export type AppointmentBookedStore = AppointmentStore<AppointmentBooked>;
export type AppointmentCheckedInStore = AppointmentStore<AppointmentCheckedIn>;
export type ExaminationStartedStore = AppointmentStore<ExaminationStarted>;
export type PaymentRecordedStore = AppointmentStore<PaymentRecorded>;
export type AppointmentCanceledStore = AppointmentStore<AppointmentCanceled>;
