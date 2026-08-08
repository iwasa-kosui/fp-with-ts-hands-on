import { eq } from "drizzle-orm";
import { okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { scryptPasswordHasher } from "../../src/adaptor/secondary/authentication/scryptPasswordHasher.js";
import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { createUserResolver } from "../../src/adaptor/secondary/sqlite/resolver/userResolver.js";
import {
  domainEventsTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createSessionEventStore } from "../../src/adaptor/secondary/sqlite/store/sessionEventStore.js";
import {
  createUserDeletedEventStore,
  createUserEventStore,
} from "../../src/adaptor/secondary/sqlite/store/userEventStore.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { Session } from "../../src/domain/session/session.js";
import { SessionId } from "../../src/domain/session/sessionId.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import { User, type User as UserState } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import type {
  UserCreated,
  UserDeleted,
  UserPasswordReset,
  UserUpdated,
} from "../../src/domain/user/userEvent.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { UserResolver } from "../../src/domain/user/userResolver.js";
import type {
  UserCreatedStore,
  UserPasswordResetStore,
  UserUpdatedStore,
} from "../../src/domain/user/userStores.js";
import {
  CreateUserUseCase,
  type Dependencies as CreateDependencies,
} from "../../src/useCase/createUserUseCase.js";
import {
  DeleteUserUseCase,
  type Dependencies as DeleteDependencies,
} from "../../src/useCase/deleteUserUseCase.js";
import { ListUsersUseCase } from "../../src/useCase/listUsersUseCase.js";
import {
  ResetUserPasswordUseCase,
  type Dependencies as ResetDependencies,
} from "../../src/useCase/resetUserPasswordUseCase.js";
import {
  UpdateUserUseCase,
  type Dependencies as UpdateDependencies,
} from "../../src/useCase/updateUserUseCase.js";

const ids = {
  actor: UserId.schema.parse("20000000-0000-4000-8000-000000000001"),
  target: UserId.schema.parse("20000000-0000-4000-8000-000000000002"),
  created: UserId.schema.parse("20000000-0000-4000-8000-000000000003"),
  session: SessionId.schema.parse("20000000-0000-4000-8000-000000000004"),
  otherSession: SessionId.schema.parse("20000000-0000-4000-8000-000000000006"),
  veterinarian: VeterinarianId.schema.parse(
    "20000000-0000-4000-8000-000000000005",
  ),
} as const;
const now = Timestamp.schema.parse("2026-08-09T02:00:00.000Z");
const password = Sensitive.of("new secure password");
const initialPassword = Sensitive.of("initial secure password");
const actorEmail = UserEmail.schema.parse("actor@example.test");
const targetEmail = UserEmail.schema.parse("target@example.test");
const changedEmail = UserEmail.schema.parse("changed@example.test");
const actorName = UserName.schema.parse("Actor Admin");
const targetName = UserName.schema.parse("Target User");
const changedName = UserName.schema.parse("Changed User");
const clock = { now: () => now } as const satisfies Clock;

const eventIdGenerator = (): EventIdGenerator => {
  let sequence = 1;
  return {
    generate: () =>
      EventId.schema.parse(
        `30000000-0000-4000-8000-${(sequence++).toString().padStart(12, "0")}`,
      ),
  };
};

const context = (sequence: number, actorUserId = ids.actor): EventContext => ({
  eventId: EventId.schema.parse(
    `40000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`,
  ),
  occurredAt: now,
  actorUserId,
});

const userResolverFor = (users: readonly UserState[]): UserResolver => ({
  resolveById: (userId) =>
    okAsync(users.find((user) => user.userId === userId)),
  resolveByEmail: (email) =>
    okAsync(users.find((user) => user.email.unwrap() === email.unwrap())),
  resolveAll: () => okAsync(users),
});

const storeEvents = <T>(events: T[]) => ({
  store: (...newEvents: readonly T[]) => {
    events.push(...newEvents);
    return okAsync(undefined);
  },
});

const fixtures = async () => {
  const passwordHash = await scryptPasswordHasher.hash(initialPassword);
  const actor = {
    kind: "Admin",
    userId: ids.actor,
    email: actorEmail,
    name: actorName,
    passwordHash,
  } as const satisfies UserState;
  const target = {
    kind: "Receptionist",
    userId: ids.target,
    email: targetEmail,
    name: targetName,
    passwordHash,
  } as const satisfies UserState;
  const veterinarian = {
    kind: "Veterinarian",
    userId: ids.target,
    email: targetEmail,
    name: targetName,
    passwordHash,
    veterinarianId: ids.veterinarian,
  } as const satisfies UserState;
  return { actor, target, veterinarian } as const;
};

describe("admin user management", () => {
  test("creates a Veterinarian with generated user and veterinarian IDs", async () => {
    const { actor } = await fixtures();
    const events: UserCreated[] = [];
    const dependencies = {
      userResolver: userResolverFor([actor]),
      userCreatedStore: storeEvents(events) satisfies UserCreatedStore,
      passwordHasher: scryptPasswordHasher,
      clock,
      eventIdGenerator: eventIdGenerator(),
      userIdGenerator: { generate: () => ids.created },
      veterinarianIdGenerator: { generate: () => ids.veterinarian },
    } as const satisfies CreateDependencies;

    const result = await CreateUserUseCase.create(dependencies).run({
      actorUserId: ids.actor,
      email: changedEmail,
      name: changedName,
      password,
      role: "Veterinarian",
    });

    expect(result._unsafeUnwrap()).toEqual({
      user: {
        kind: "Veterinarian",
        userId: ids.created,
        email: changedEmail,
        name: changedName,
        veterinarianId: ids.veterinarian,
      },
    });
    expect(events[0]?.aggregateState).toMatchObject({
      kind: "Veterinarian",
      userId: ids.created,
      veterinarianId: ids.veterinarian,
    });
    expect(Object.keys(result._unsafeUnwrap().user)).not.toContain(
      "passwordHash",
    );
  });

  test("preserves a Veterinarian ID across profile updates and removes it on role change", async () => {
    const { actor, veterinarian } = await fixtures();
    const veterinarianEvents: UserUpdated[] = [];
    const base = {
      userUpdatedStore: storeEvents(
        veterinarianEvents,
      ) satisfies UserUpdatedStore,
      clock,
      eventIdGenerator: eventIdGenerator(),
      veterinarianIdGenerator: {
        generate: () =>
          VeterinarianId.schema.parse("20000000-0000-4000-8000-000000000099"),
      },
    } as const;

    const preserved = await UpdateUserUseCase.create({
      ...base,
      userResolver: userResolverFor([actor, veterinarian]),
    } satisfies UpdateDependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
      email: changedEmail,
      name: changedName,
      role: "Veterinarian",
    });

    expect(preserved._unsafeUnwrap().user).toMatchObject({
      kind: "Veterinarian",
      veterinarianId: ids.veterinarian,
      email: changedEmail,
      name: changedName,
    });

    const changedRole = await UpdateUserUseCase.create({
      ...base,
      userResolver: userResolverFor([actor, veterinarian]),
    } satisfies UpdateDependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
      email: changedEmail,
      name: changedName,
      role: "Receptionist",
    });

    expect(changedRole._unsafeUnwrap().user).toEqual({
      kind: "Receptionist",
      userId: ids.target,
      email: changedEmail,
      name: changedName,
    });
  });

  test("generates a Veterinarian ID when another role is promoted", async () => {
    const { actor, target } = await fixtures();
    const result = await UpdateUserUseCase.create({
      userResolver: userResolverFor([actor, target]),
      userUpdatedStore: storeEvents<UserUpdated>([]),
      clock,
      eventIdGenerator: eventIdGenerator(),
      veterinarianIdGenerator: { generate: () => ids.veterinarian },
    } satisfies UpdateDependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
      email: targetEmail,
      name: targetName,
      role: "Veterinarian",
    });

    expect(result._unsafeUnwrap().user).toMatchObject({
      kind: "Veterinarian",
      veterinarianId: ids.veterinarian,
    });
  });

  test("resets a target password through a UserPasswordReset event", async () => {
    const { actor, target } = await fixtures();
    const events: UserPasswordReset[] = [];
    const dependencies = {
      userResolver: userResolverFor([actor, target]),
      userPasswordResetStore: storeEvents(
        events,
      ) satisfies UserPasswordResetStore,
      passwordHasher: scryptPasswordHasher,
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const satisfies ResetDependencies;

    const result = await ResetUserPasswordUseCase.create(dependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
      password,
    });

    expect(result.isOk()).toBe(true);
    expect(events[0]?.kind).toBe("UserPasswordReset");
    expect(
      await scryptPasswordHasher.verify(
        password,
        events[0]!.aggregateState.passwordHash,
      ),
    ).toBe(true);
    expect(Object.keys(result._unsafeUnwrap().user)).not.toContain(
      "passwordHash",
    );
  });

  test("rejects non-Admin management before producing events", async () => {
    const { target } = await fixtures();
    const events: UserCreated[] = [];
    const useCase = CreateUserUseCase.create({
      userResolver: userResolverFor([target]),
      userCreatedStore: storeEvents(events),
      passwordHasher: scryptPasswordHasher,
      clock,
      eventIdGenerator: eventIdGenerator(),
      userIdGenerator: { generate: () => ids.created },
      veterinarianIdGenerator: { generate: () => ids.veterinarian },
    });

    const result = await useCase.run({
      actorUserId: ids.target,
      email: changedEmail,
      name: changedName,
      password,
      role: "Admin",
    });

    expect(result.isErr() && result.error.kind).toBe("Unauthorized");
    expect(events).toHaveLength(0);
  });

  test("rejects self-delete and deletion of the last Admin", async () => {
    const { actor } = await fixtures();
    const base = {
      userDeletedStore: storeEvents<UserDeleted>([]),
      clock,
      eventIdGenerator: eventIdGenerator(),
    } as const;

    const selfDelete = await DeleteUserUseCase.create({
      ...base,
      userResolver: userResolverFor([actor]),
    } satisfies DeleteDependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.actor,
    });
    expect(selfDelete.isErr() && selfDelete.error).toEqual({
      kind: "CannotDeleteSelf",
    });

    const soleAdmin = {
      ...actor,
      userId: ids.target,
    } as const satisfies UserState;
    const lastAdmin = await DeleteUserUseCase.create({
      ...base,
      userResolver: {
        resolveById: (userId) =>
          okAsync(userId === ids.actor ? actor : soleAdmin),
        resolveByEmail: () => okAsync(undefined),
        resolveAll: () => okAsync([soleAdmin]),
      },
    } satisfies DeleteDependencies).run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
    });
    expect(lastAdmin.isErr() && lastAdmin.error).toEqual({
      kind: "CannotDeleteLastAdmin",
    });
  });

  test("lists Admin-visible users without password hashes", async () => {
    const { actor, target } = await fixtures();
    const result = await ListUsersUseCase.create({
      userResolver: userResolverFor([actor, target]),
    }).run({ actorUserId: ids.actor });

    expect(result._unsafeUnwrap().users).toHaveLength(2);
    expect(
      result._unsafeUnwrap().users.every((user) => !("passwordHash" in user)),
    ).toBe(true);
  });
});

describe("DeleteUserUseCase SQLite integration", () => {
  test("physically deletes the user, cascades sessions, and retains redacted deletion history", async () => {
    const { actor, target } = await fixtures();
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const userStore = createUserEventStore(db);
    await userStore.store(
      User.create(context(1))(actor),
      User.create(context(2))(target),
    );
    const session = {
      sessionId: ids.session,
      userId: ids.target,
      tokenHash: SessionTokenHash.schema.parse("b".repeat(64)),
      expiresAt: Timestamp.schema.parse("2026-08-09T10:00:00.000Z"),
    } as const;
    await createSessionEventStore(db).store(
      Session.create(context(3))(session),
    );
    const useCase = DeleteUserUseCase.create({
      userResolver: createUserResolver(db),
      userDeletedStore: createUserDeletedEventStore(db),
      clock,
      eventIdGenerator: eventIdGenerator(),
    });

    const result = await useCase.run({
      actorUserId: ids.actor,
      targetUserId: ids.target,
    });

    expect(result._unsafeUnwrap()).toEqual({ userId: ids.target });
    expect(
      await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.userId, ids.target)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.userId, ids.target)),
    ).toHaveLength(0);
    const history = await db.select().from(domainEventsTable);
    expect(history.map(({ eventName }) => eventName)).toContain("user.deleted");
    const deletion = history.find(
      ({ eventName }) => eventName === "user.deleted",
    );
    expect(deletion?.aggregateState).toBeNull();
    expect(JSON.stringify(deletion)).not.toContain(targetEmail.unwrap());
    expect(JSON.stringify(deletion)).not.toContain(targetName.unwrap());
    expect(JSON.stringify(deletion)).not.toContain(
      target.passwordHash.unwrap(),
    );
  });

  test("authoritatively guards reciprocal stale-read deletes from removing every Admin", async () => {
    const { actor } = await fixtures();
    const otherAdmin = {
      ...actor,
      userId: ids.target,
      email: targetEmail,
      name: targetName,
    } as const satisfies UserState;
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    await createUserEventStore(db).store(
      User.create(context(10))(actor),
      User.create(context(11))(otherAdmin),
    );
    const sessions = [
      {
        sessionId: ids.session,
        userId: ids.actor,
        tokenHash: SessionTokenHash.schema.parse("c".repeat(64)),
        expiresAt: Timestamp.schema.parse("2026-08-09T10:00:00.000Z"),
      },
      {
        sessionId: ids.otherSession,
        userId: ids.target,
        tokenHash: SessionTokenHash.schema.parse("d".repeat(64)),
        expiresAt: Timestamp.schema.parse("2026-08-09T10:00:00.000Z"),
      },
    ] as const;
    await createSessionEventStore(db).store(
      ...sessions.map((session, index) =>
        Session.create(context(12 + index, session.userId))(session),
      ),
    );
    const staleResolver = userResolverFor([actor, otherAdmin]);
    const deletionStore = createUserDeletedEventStore(db);
    const deleteOther = DeleteUserUseCase.create({
      userResolver: staleResolver,
      userDeletedStore: deletionStore,
      clock,
      eventIdGenerator: eventIdGenerator(),
    });
    const deleteActor = DeleteUserUseCase.create({
      userResolver: staleResolver,
      userDeletedStore: deletionStore,
      clock,
      eventIdGenerator: eventIdGenerator(),
    });

    const results = await Promise.all([
      deleteOther.run({ actorUserId: ids.actor, targetUserId: ids.target }),
      deleteActor.run({ actorUserId: ids.target, targetUserId: ids.actor }),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(results.filter((result) => result.isErr())).toHaveLength(1);
    expect(
      results.find((result) => result.isErr())?._unsafeUnwrapErr(),
    ).toEqual({
      kind: "CannotDeleteLastAdmin",
    });
    const remainingUsers = await db.select().from(usersTable);
    expect(remainingUsers).toHaveLength(1);
    const remainingSessions = await db.select().from(sessionsTable);
    expect(remainingSessions).toHaveLength(1);
    expect(remainingSessions[0]?.userId).toBe(remainingUsers[0]?.userId);
    const deletionHistory = (await db.select().from(domainEventsTable)).filter(
      ({ eventName }) => eventName === "user.deleted",
    );
    expect(deletionHistory).toHaveLength(1);
    expect(deletionHistory[0]?.aggregateId).not.toBe(remainingUsers[0]?.userId);
  });
});
