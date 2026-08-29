import type { DomainEvent } from "../aggregate/domainEvent.js";
import type { EventContext } from "../aggregate/eventContext.js";
import type { PetId } from "../pet/index.js";
import type { ExamId } from "./examId.js";
import type { ExamResult } from "./examResult.js";

type ExamResultEventPayload = Readonly<{ examId: ExamId; petId: PetId }>;

type ExamResultDomainEvent<
  TAggregateState extends ExamResult | undefined,
  TKind extends string,
  TEventName extends string,
> = Readonly<
  Omit<
    DomainEvent<ExamId, "ExamResult", TAggregateState, TKind, TEventName, ExamResultEventPayload>,
    "aggregateState"
  > & {
    aggregateState: TAggregateState;
  }
>;

export type ExamResultRecorded = ExamResultDomainEvent<
  ExamResult,
  "ExamResultRecorded",
  "exam-result.recorded"
>;
export type ExamResultUpdated = ExamResultDomainEvent<
  ExamResult,
  "ExamResultUpdated",
  "exam-result.updated"
>;
export type ExamResultDeleted = ExamResultDomainEvent<
  undefined,
  "ExamResultDeleted",
  "exam-result.deleted"
>;

export type ExamResultEvent = ExamResultRecorded | ExamResultUpdated | ExamResultDeleted;

const create = <
  TAggregateState extends ExamResult | undefined,
  TKind extends string,
  TEventName extends string,
>(
  context: EventContext,
  aggregateId: ExamId,
  petId: PetId,
  aggregateState: TAggregateState,
  kind: TKind,
  eventName: TEventName,
): ExamResultDomainEvent<TAggregateState, TKind, TEventName> => ({
  kind,
  eventId: context.eventId,
  aggregateId,
  aggregateName: "ExamResult",
  aggregateState,
  eventName,
  eventPayload: { examId: aggregateId, petId },
  occurredAt: context.occurredAt,
  actorUserId: context.actorUserId,
});

export const createExamResultRecorded = (
  context: EventContext,
  result: ExamResult,
): ExamResultRecorded =>
  create(
    context,
    result.examId,
    result.petId,
    result,
    "ExamResultRecorded",
    "exam-result.recorded",
  );

export const createExamResultUpdated = (
  context: EventContext,
  result: ExamResult,
): ExamResultUpdated =>
  create(
    context,
    result.examId,
    result.petId,
    result,
    "ExamResultUpdated",
    "exam-result.updated",
  );

export const createExamResultDeleted = (
  context: EventContext,
  result: ExamResult,
): ExamResultDeleted =>
  create(
    context,
    result.examId,
    result.petId,
    undefined,
    "ExamResultDeleted",
    "exam-result.deleted",
  );
