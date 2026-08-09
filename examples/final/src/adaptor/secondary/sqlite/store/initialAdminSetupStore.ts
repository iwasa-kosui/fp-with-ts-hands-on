import { err, ok, ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { SessionCreated } from "../../../../domain/session/sessionEvent.js";
import type { UserCreated } from "../../../../domain/user/userEvent.js";
import type {
  InitialAdminAlreadyExists,
  InitialAdminSetupStore,
} from "../../../../useCase/persistence/initialAdminSetupStore.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import {
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
    ResultAsync.fromPromise(
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
          persistDomainEvent(tx, userEvent);

          tx.insert(sessionsTable)
            .values(sessionProjection(sessionEvent))
            .run();
          persistDomainEvent(tx, sessionEvent);
          return ok(undefined);
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "InitialAdminSetupStore.store",
        cause,
      }),
    ).andThen((result) => result),
});
