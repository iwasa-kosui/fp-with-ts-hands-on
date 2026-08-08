import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import type { SessionResolver } from "../../../../domain/session/sessionResolver.js";
import { SessionId } from "../../../../domain/session/sessionId.js";
import { SessionTokenHash } from "../../../../domain/session/sessionTokenHash.js";
import { UserId } from "../../../../domain/user/userId.js";
import type { SqliteDatabase } from "../db.js";
import { sessionsTable } from "../schema.js";

const SessionRowSchema = z.object({
  sessionId: SessionId.schema,
  userId: UserId.schema,
  tokenHash: SessionTokenHash.schema,
  expiresAt: Timestamp.schema,
});

const parseRow = (row: typeof sessionsTable.$inferSelect) => SessionRowSchema.parse(row);
const repositoryError = (operation: string) => (cause: unknown): RepositoryError => ({
  kind: "RepositoryError",
  operation,
  cause,
});

export const createSessionResolver = (db: SqliteDatabase): SessionResolver => ({
  resolveById: (sessionId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(sessionsTable).where(eq(sessionsTable.sessionId, sessionId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("SessionResolver.resolveById"),
    ),
  resolveByTokenHash: (tokenHash) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db.select().from(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash.unwrap())).get();
        return row === undefined ? undefined : parseRow(row);
      }),
      repositoryError("SessionResolver.resolveByTokenHash"),
    ),
  resolveByUserId: (userId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId)).all().map(parseRow),
      ),
      repositoryError("SessionResolver.resolveByUserId"),
    ),
});
