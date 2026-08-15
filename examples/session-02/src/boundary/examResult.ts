import type { ExamId } from "../domain/ids/examId.js";
import type { PetId } from "../domain/ids/petId.js";
import { ok, type Result } from "../shared/schemaResult.js";

export type ExamResult = Readonly<{
  examId: ExamId;
  petId: PetId;
  items: ReadonlyArray<string>;
  needsFollowUp: boolean;
}>;

export const parseExamResult = (raw: any): Result<ExamResult> =>
  ok({
    examId: raw.examId,
    petId: raw.petId,
    items: raw.items ?? [],
    needsFollowUp: !!raw.needsFollowUp,
  });
