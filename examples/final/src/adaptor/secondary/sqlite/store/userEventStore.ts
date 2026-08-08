import { eq } from "drizzle-orm";
import { err, errAsync, ok, ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type {
  UserCreated,
  UserDeleted,
  UserPasswordReset,
  UserUpdated,
} from "../../../../domain/user/userEvent.js";
import type {
  CannotDeleteLastAdminStoreError,
  UserDeletedStore,
} from "../../../../domain/user/userStores.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, usersTable } from "../schema.js";
import type { SqliteDatabase } from "../db.js";

type UserEvent = UserCreated | UserUpdated | UserPasswordReset;
type AnyUserEvent = UserEvent | UserDeleted;

const projectionValues = (
  state: Exclude<UserEvent["aggregateState"], undefined>,
) => ({
  userId: state.userId,
  role: state.kind,
  email: state.email.unwrap(),
  name: state.name.unwrap(),
  passwordHash: state.passwordHash.unwrap(),
  veterinarianId: state.kind === "Veterinarian" ? state.veterinarianId : null,
});

const safeState = (state: Exclude<UserEvent["aggregateState"], undefined>) => ({
  kind: state.kind,
  userId: state.userId,
  ...(state.kind === "Veterinarian"
    ? { veterinarianId: state.veterinarianId }
    : {}),
});

const createUserProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly UserEvent[]) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() =>
          db.transaction((tx) => {
            events.forEach((event) => {
              switch (event.kind) {
                case "UserCreated":
                case "UserUpdated":
                case "UserPasswordReset": {
                  const values = projectionValues(event.aggregateState);
                  tx.insert(usersTable)
                    .values(values)
                    .onConflictDoUpdate({
                      target: usersTable.userId,
                      set: values,
                    })
                    .run();
                  const payload =
                    event.kind === "UserPasswordReset"
                      ? { userId: event.aggregateId }
                      : {
                          userId: event.aggregateId,
                          role: event.aggregateState.kind,
                        };
                  tx.insert(domainEventsTable)
                    .values(
                      toEventRecord(
                        event,
                        safeState(event.aggregateState),
                        payload,
                      ),
                    )
                    .run();
                  return;
                }
                default:
                  return assertNever(event);
              }
            });
          }),
        ),
        (cause): RepositoryError => ({
          kind: "RepositoryError",
          operation: "UserEventStore.store",
          cause,
        }),
      ),
  }) as const;

const cannotDeleteLastAdmin = (): CannotDeleteLastAdminStoreError => ({
  kind: "CannotDeleteLastAdmin",
});

export const createUserDeletedEventStore = (
  db: SqliteDatabase,
): UserDeletedStore => ({
  store: (...events) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const adminIds = tx
            .select({ userId: usersTable.userId })
            .from(usersTable)
            .where(eq(usersTable.role, "Admin"))
            .all()
            .map(({ userId }) => userId);
          const adminIdSet = new Set(adminIds);
          const deletedAdminIds = new Set(
            events
              .map(({ aggregateId }) => aggregateId)
              .filter((userId) => adminIdSet.has(userId)),
          );

          if (
            deletedAdminIds.size > 0 &&
            adminIds.length - deletedAdminIds.size < 1
          ) {
            return err(cannotDeleteLastAdmin());
          }

          events.forEach((event) => {
            tx.delete(usersTable)
              .where(eq(usersTable.userId, event.aggregateId))
              .run();
            tx.insert(domainEventsTable)
              .values(
                toEventRecord(event, undefined, {
                  userId: event.aggregateId,
                }),
              )
              .run();
          });
          return ok(undefined);
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "UserDeletedEventStore.store",
        cause,
      }),
    ).andThen((result) => result),
});

const mixedEventKindsError = (): RepositoryError => ({
  kind: "RepositoryError",
  operation: "UserEventStore.store",
  cause: new TypeError(
    "User deletion events require an isolated guarded transaction",
  ),
});

export const createUserEventStore = (db: SqliteDatabase) => {
  const projectionStore = createUserProjectionEventStore(db);
  const deletionStore = createUserDeletedEventStore(db);

  function store(
    ...events: readonly UserEvent[]
  ): ReturnType<typeof projectionStore.store>;
  function store(
    ...events: readonly UserDeleted[]
  ): ReturnType<typeof deletionStore.store>;
  function store(...events: readonly AnyUserEvent[]) {
    const deletionEvents = events.filter(
      (event) => event.kind === "UserDeleted",
    );
    const projectionEvents = events.filter(
      (event) => event.kind !== "UserDeleted",
    );

    if (deletionEvents.length > 0 && projectionEvents.length > 0) {
      return errAsync(mixedEventKindsError());
    }

    return deletionEvents.length > 0
      ? deletionStore.store(...deletionEvents)
      : projectionStore.store(...projectionEvents);
  }

  return { store } as const;
};
