import type { ResultAsync } from "neverthrow";
import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { AppointmentId } from "./appointmentId.js";
import type { AppointmentVersion } from "./appointmentVersion.js";
import type {
  AppointmentBooked,
  AppointmentCanceled,
  AppointmentCheckedIn,
  ExaminationStarted,
  PaymentRecorded,
} from "./appointmentEvent.js";

export type StaleAppointmentVersion = Readonly<{
  kind: "StaleAppointmentVersion";
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
}>;
export type AppointmentStoreError = RepositoryError | StaleAppointmentVersion;
type AppointmentStore<TEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, AppointmentStoreError>;
}>;
export type AppointmentBookedStore = AppointmentStore<AppointmentBooked>;
export type AppointmentCheckedInStore = AppointmentStore<AppointmentCheckedIn>;
export type ExaminationStartedStore = AppointmentStore<ExaminationStarted>;
export type PaymentRecordedStore = AppointmentStore<PaymentRecorded>;
export type AppointmentCanceledStore = AppointmentStore<AppointmentCanceled>;
