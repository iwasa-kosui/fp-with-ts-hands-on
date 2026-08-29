import type { ResultAsync } from "neverthrow";
import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { AppointmentExaminationCompleted } from "../appointment/index.js";
import type { AppointmentStoreError } from "../appointment/index.js";
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
