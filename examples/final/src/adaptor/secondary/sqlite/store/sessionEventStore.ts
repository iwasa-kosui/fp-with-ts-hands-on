import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SessionCreated, SessionDeleted } from "../../../../domain/session/sessionEvent.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import { sessionsTable } from "../schema.js";

type SessionEvent = SessionCreated | SessionDeleted;

export const createSessionEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly SessionEvent[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            switch (event.kind) {
              case "SessionCreated": {
                const state = event.aggregateState;
                const values = {
                  sessionId: state.sessionId,
                  userId: state.userId,
                  tokenHash: state.tokenHash.unwrap(),
                  expiresAt: state.expiresAt,
                };
                tx.insert(sessionsTable)
                  .values(values)
                  .onConflictDoUpdate({ target: sessionsTable.sessionId, set: values })
                  .run();
                persistDomainEvent(tx, event);
                return;
              }
              case "SessionDeleted":
                tx.delete(sessionsTable).where(eq(sessionsTable.sessionId, event.aggregateId)).run();
                persistDomainEvent(tx, event);
                return;
              default:
                return assertNever(event);
            }
          });
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "SessionEventStore.store",
        cause,
      }),
    ),
} as const);
