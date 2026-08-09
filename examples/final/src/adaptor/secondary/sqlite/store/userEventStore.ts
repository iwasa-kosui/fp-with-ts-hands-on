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
  CannotDowngradeLastAdminStoreError,
  CannotDeleteLastAdminStoreError,
  UserDeletedStore,
  UserDeletedStoreError,
  UserUpdatedStoreError,
} from "../../../../domain/user/userStores.js";
import { persistDomainEvent } from "../eventPersistence.js";
import { usersTable } from "../schema.js";
import type { SqliteDatabase } from "../db.js";

type UserEvent = UserCreated | UserUpdated | UserPasswordReset;
type AnyUserEvent = UserEvent | UserDeleted;
type AnyUserStoreError = UserUpdatedStoreError | UserDeletedStoreError;

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

const createUserProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly UserEvent[]) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() =>
          db.transaction((tx) => {
            const adminIds = new Set(
              tx
                .select({ userId: usersTable.userId })
                .from(usersTable)
                .where(eq(usersTable.role, "Admin"))
                .all()
                .map(({ userId }) => userId),
            );
            let removesAdminRole = false;
            events.forEach((event) => {
              if (event.kind !== "UserUpdated") return;
              const wasAdmin = adminIds.has(event.aggregateId);
              if (event.aggregateState.kind === "Admin") {
                adminIds.add(event.aggregateId);
                return;
              }
              adminIds.delete(event.aggregateId);
              removesAdminRole = removesAdminRole || wasAdmin;
            });
            if (removesAdminRole && adminIds.size < 1) {
              return err(cannotDowngradeLastAdmin());
            }

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
                  persistDomainEvent(tx, event);
                  return;
                }
                default:
                  return assertNever(event);
              }
            });
            return ok(undefined);
          }),
        ),
        (cause): RepositoryError => ({
          kind: "RepositoryError",
          operation: "UserEventStore.store",
          cause,
        }),
      ).andThen((result) => result),
  }) as const;

const cannotDowngradeLastAdmin =
  (): CannotDowngradeLastAdminStoreError => ({
    kind: "CannotDowngradeLastAdmin",
  });

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
            persistDomainEvent(tx, event);
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
    ...events: readonly UserCreated[]
  ): ResultAsync<void, RepositoryError>;
  function store(
    ...events: readonly UserUpdated[]
  ): ResultAsync<void, UserUpdatedStoreError>;
  function store(
    ...events: readonly UserPasswordReset[]
  ): ResultAsync<void, RepositoryError>;
  function store(
    ...events: readonly UserDeleted[]
  ): ReturnType<typeof deletionStore.store>;
  function store(
    ...events: readonly AnyUserEvent[]
  ): ResultAsync<void, AnyUserStoreError> {
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
      ? deletionStore
          .store(...deletionEvents)
          .mapErr((error): AnyUserStoreError => error)
      : projectionStore
          .store(...projectionEvents)
          .mapErr((error): AnyUserStoreError => error);
  }

  return { store } as const;
};
