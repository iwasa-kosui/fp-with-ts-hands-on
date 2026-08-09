import type { ResultAsync } from "neverthrow";
import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { AppointmentExaminationCompleted } from "../appointment/appointmentEvent.js";
import type { AppointmentStoreError } from "../appointment/appointmentStores.js";
import type { ExamResultDeleted, ExamResultRecorded, ExamResultUpdated } from "./examResultEvent.js";

export type ExamResultRecordedStore = AggregateStore<ExamResultRecorded>;
export type ExamResultUpdatedStore = AggregateStore<ExamResultUpdated>;
export type ExamResultDeletedStore = AggregateStore<ExamResultDeleted>;
export type ExaminationCompletionStore = Readonly<{
  store: (
    examResult: ExamResultRecorded,
    appointment: AppointmentExaminationCompleted,
  ) => ResultAsync<void, AppointmentStoreError>;
}>;
