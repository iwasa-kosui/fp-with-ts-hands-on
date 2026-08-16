import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import type {
  SessionByIdResolver,
  SessionByTokenHashResolver,
  SessionByUserIdResolver,
} from "../../../../domain/session/sessionResolver.js";
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
export const createSessionByIdResolver = (db: SqliteDatabase): SessionByIdResolver => ({
  resolveById: (sessionId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(sessionsTable).where(eq(sessionsTable.sessionId, sessionId)).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createSessionByTokenHashResolver = (
  db: SqliteDatabase,
): SessionByTokenHashResolver => ({
  resolveByTokenHash: (tokenHash) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db.select().from(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash.unwrap())).get();
        return row === undefined ? undefined : parseRow(row);
      }),
    ),
});

export const createSessionByUserIdResolver = (
  db: SqliteDatabase,
): SessionByUserIdResolver => ({
  resolveByUserId: (userId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.select().from(sessionsTable).where(eq(sessionsTable.userId, userId)).all().map(parseRow),
      ),
    ),
});
