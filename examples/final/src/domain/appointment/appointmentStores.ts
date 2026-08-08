import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type {
  AppointmentBooked,
  AppointmentCanceled,
  AppointmentCheckedIn,
  ExaminationStarted,
  PaymentRecorded,
} from "./appointmentEvent.js";

export type AppointmentBookedStore = AggregateStore<AppointmentBooked>;
export type AppointmentCheckedInStore = AggregateStore<AppointmentCheckedIn>;
export type ExaminationStartedStore = AggregateStore<ExaminationStarted>;
export type PaymentRecordedStore = AggregateStore<PaymentRecorded>;
export type AppointmentCanceledStore = AggregateStore<AppointmentCanceled>;
