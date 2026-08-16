import type { ResultAsync } from "neverthrow";

import type { PetId } from "../pet/petId.js";
import type { ExamId } from "./examId.js";
import type { ExamResult } from "./examResult.js";

export type ExamResultByIdResolver = Readonly<{
  resolveById: (examId: ExamId) => ResultAsync<ExamResult | undefined, never>;
}>;

export type ExamResultByPetIdResolver = Readonly<{
  resolveByPetId: (petId: PetId) => ResultAsync<readonly ExamResult[], never>;
}>;
