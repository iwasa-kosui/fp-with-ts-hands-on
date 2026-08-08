import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { ExamResult } from "../../../../domain/examResult/examResult.js";
import type { ExamResultResolver } from "../../../../domain/examResult/examResultResolver.js";
import type { SqliteDatabase } from "../db.js";
import { examResultsTable } from "../schema.js";

export const parseExamResultState = (state: unknown) => ExamResult.schema.parse(state);
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
        return row === undefined ? undefined : parseExamResultState(row.state);
      }),
      repositoryError("ExamResultResolver.resolveById"),
    ),
  resolveByPetId: (petId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(examResultsTable)
          .where(eq(examResultsTable.petId, petId))
          .all()
          .map(({ state }) => parseExamResultState(state)),
      ),
      repositoryError("ExamResultResolver.resolveByPetId"),
    ),
});
