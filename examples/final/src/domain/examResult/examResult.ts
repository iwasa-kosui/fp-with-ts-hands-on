import { z } from "zod";

import type { EventContext } from "../aggregate/eventContext.js";
import { Timestamp } from "../aggregate/timestamp.js";
import { PetId } from "../pet/petId.js";
import { schemaResult } from "../shared/schemaResult.js";
import { Sensitive } from "../shared/sensitive.js";
import { ExamId } from "./examId.js";
import {
  ExamResultEvent,
  type ExamResultDeleted,
  type ExamResultRecorded,
  type ExamResultUpdated,
} from "./examResultEvent.js";

const ExamResultSchema = z
  .object({
    examId: ExamId.schema,
    petId: PetId.schema,
    collectedAt: Timestamp.schema,
    items: z.array(z.string().trim().min(1).transform(Sensitive.of)).min(1).readonly(),
    needsFollowUp: z.boolean().default(false),
  })
  .readonly();

export type ExamResult = Readonly<z.infer<typeof ExamResultSchema>>;
export type ExamResultUpdate = Readonly<Pick<ExamResult, "items" | "needsFollowUp">>;

const create = (context: EventContext) => (result: ExamResult): ExamResultRecorded =>
  ExamResultEvent.create(
    context,
    result.examId,
    result.petId,
    result,
    "ExamResultRecorded",
    "exam-result.recorded",
  );

const update =
  (context: EventContext) =>
  (result: ExamResult, changes: ExamResultUpdate): ExamResultUpdated => {
    const aggregateState = { ...result, ...changes } as const satisfies ExamResult;

    return ExamResultEvent.create(
      context,
      result.examId,
      result.petId,
      aggregateState,
      "ExamResultUpdated",
      "exam-result.updated",
    );
  };

const remove = (context: EventContext) => (result: ExamResult): ExamResultDeleted =>
  ExamResultEvent.create(
    context,
    result.examId,
    result.petId,
    undefined,
    "ExamResultDeleted",
    "exam-result.deleted",
  );

export const ExamResult = {
  schema: ExamResultSchema,
  parse: schemaResult(ExamResultSchema),
  create,
  update,
  delete: remove,
} as const;
