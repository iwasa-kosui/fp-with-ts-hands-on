import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { ExamResult } from "../../../../domain/examResult/examResult.js";
import type {
  ExamResultByIdResolver,
  ExamResultByPetIdResolver,
} from "../../../../domain/examResult/examResultResolver.js";
import { ExamId } from "../../../../domain/examResult/examId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import type { SqliteDatabase } from "../db.js";
import { examResultsTable } from "../schema.js";

export const parseExamResultState = (state: unknown) => ExamResult.schema.parse(state);
const ExamResultRowSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  state: z.unknown(),
});
export const parseExamResultRow = (raw: unknown) => {
  const row = ExamResultRowSchema.parse(raw);
  const state = parseExamResultState(row.state);
  if (row.examId !== state.examId || row.petId !== state.petId) {
    throw new TypeError("Corrupt exam result projection");
  }
  return state;
};
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createExamResultByIdResolver = (db: SqliteDatabase): ExamResultByIdResolver => ({
  resolveById: (examId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(examResultsTable).where(eq(examResultsTable.examId, examId)).get();
        return row === undefined ? undefined : parseExamResultRow(row);
      }),
      repositoryError("ExamResultByIdResolver.resolveById"),
    ),
});

export const createExamResultByPetIdResolver = (
  db: SqliteDatabase,
): ExamResultByPetIdResolver => ({
  resolveByPetId: (petId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(examResultsTable)
          .where(eq(examResultsTable.petId, petId))
          .all()
          .map(parseExamResultRow),
      ),
      repositoryError("ExamResultByPetIdResolver.resolveByPetId"),
    ),
});
