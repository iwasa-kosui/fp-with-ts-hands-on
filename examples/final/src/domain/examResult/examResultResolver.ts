import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { PetId } from "../pet/petId.js";
import type { ExamId } from "./examId.js";
import type { ExamResult } from "./examResult.js";

export type ExamResultResolver = Readonly<{
  resolveById: (examId: ExamId) => ResultAsync<ExamResult | undefined, RepositoryError>;
  resolveByPetId: (petId: PetId) => ResultAsync<readonly ExamResult[], RepositoryError>;
}>;
