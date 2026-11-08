import type { ExamId } from "../domain/examResult/index.js";
import type { PetId } from "../domain/pet/index.js";
import { ok, type Result } from "../shared/schemaResult.js";

export type ExamResult = Readonly<{
  examId: ExamId;
  petId: PetId;
  items: ReadonlyArray<string>;
  needsFollowUp: boolean;
}>;

export const ExamResult = {
  parse: (raw: any): Result<ExamResult> =>
    ok({
      examId: raw.examId,
      petId: raw.petId,
      items: raw.items ?? [],
      needsFollowUp: !!raw.needsFollowUp,
    }),
} as const;
