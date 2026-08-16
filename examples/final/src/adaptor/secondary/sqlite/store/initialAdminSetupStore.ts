import { err, ok, ResultAsync } from "neverthrow";

import type { SessionCreated } from "../../../../domain/session/sessionEvent.js";
import type { UserCreated } from "../../../../domain/user/userEvent.js";
import type {
  InitialAdminAlreadyExists,
  InitialAdminSetupStore,
} from "../../../../useCase/persistence/initialAdminSetupStore.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import {
  domainEventsTable,
  installationTable,
  sessionsTable,
  usersTable,
} from "../schema.js";

const installationKey = "clinic";

const initialAdminAlreadyExists = (): InitialAdminAlreadyExists => ({
  kind: "InitialAdminAlreadyExists",
});

const userProjection = (event: UserCreated) => ({
  userId: event.aggregateState.userId,
  role: event.aggregateState.kind,
  email: event.aggregateState.email.unwrap(),
  name: event.aggregateState.name.unwrap(),
  passwordHash: event.aggregateState.passwordHash.unwrap(),
  veterinarianId: null,
});

const sessionProjection = (event: SessionCreated) => ({
  sessionId: event.aggregateState.sessionId,
  userId: event.aggregateState.userId,
  tokenHash: event.aggregateState.tokenHash.unwrap(),
  expiresAt: event.aggregateState.expiresAt,
});

export const createInitialAdminSetupStore = (
  db: SqliteDatabase,
): InitialAdminSetupStore => ({
  store: (userEvent, sessionEvent) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const claim = tx
            .insert(installationTable)
            .values({ installationKey })
            .onConflictDoNothing()
            .run();
          if (claim.changes === 0) {
            return err(initialAdminAlreadyExists());
          }

          tx.insert(usersTable).values(userProjection(userEvent)).run();
          tx.insert(domainEventsTable)
            .values(
              toEventRecord(
                userEvent,
                {
                  kind: userEvent.aggregateState.kind,
                  userId: userEvent.aggregateState.userId,
                },
                {
                  userId: userEvent.aggregateId,
                  role: userEvent.aggregateState.kind,
                },
              ),
            )
            .run();

          tx.insert(sessionsTable)
            .values(sessionProjection(sessionEvent))
            .run();
          tx.insert(domainEventsTable)
            .values(
              toEventRecord(
                sessionEvent,
                {
                  sessionId: sessionEvent.aggregateState.sessionId,
                  userId: sessionEvent.aggregateState.userId,
                  expiresAt: sessionEvent.aggregateState.expiresAt,
                },
                {
                  sessionId: sessionEvent.aggregateId,
                  userId: sessionEvent.aggregateState.userId,
                },
              ),
            )
            .run();
          return ok(undefined);
        }),
      ),
    ).andThen((result) => result),
});
