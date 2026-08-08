import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { ExamResult } from "../../../../domain/examResult/examResult.js";
import type { ExamResultResolver } from "../../../../domain/examResult/examResultResolver.js";
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

export const createExamResultResolver = (db: SqliteDatabase): ExamResultResolver => ({
  resolveById: (examId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(examResultsTable).where(eq(examResultsTable.examId, examId)).get();
        return row === undefined ? undefined : parseExamResultRow(row);
      }),
      repositoryError("ExamResultResolver.resolveById"),
    ),
  resolveByPetId: (petId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(examResultsTable)
          .where(eq(examResultsTable.petId, petId))
          .all()
          .map(parseExamResultRow),
      ),
      repositoryError("ExamResultResolver.resolveByPetId"),
    ),
});
