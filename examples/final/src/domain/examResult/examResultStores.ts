import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { ExamResultDeleted, ExamResultRecorded, ExamResultUpdated } from "./examResultEvent.js";

export type ExamResultRecordedStore = AggregateStore<ExamResultRecorded>;
export type ExamResultUpdatedStore = AggregateStore<ExamResultUpdated>;
export type ExamResultDeletedStore = AggregateStore<ExamResultDeleted>;
