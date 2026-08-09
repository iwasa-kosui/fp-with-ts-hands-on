import { readFileSync } from "node:fs";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  domainEventsTable,
  installationTable,
  sessionsTable,
  sqliteSchema,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createInitialAdminSetupStore } from "../../src/adaptor/secondary/sqlite/store/initialAdminSetupStore.js";
import { createInstallationStatusQuery } from "../../src/adaptor/secondary/sqlite/query/installationStatusQuery.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Session } from "../../src/domain/session/session.js";
import { SessionId } from "../../src/domain/session/sessionId.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

const now = Timestamp.schema.parse("2026-08-09T01:30:00.000Z");
const expiresAt = Timestamp.schema.parse("2026-08-09T09:30:00.000Z");

const createMigrationHarness = () => {
  const client = new Database(":memory:");
  client.pragma("foreign_keys = ON");
  return { client, db: drizzle(client, { schema: sqliteSchema }) } as const;
};

const applyMigration = (
  client: ReturnType<typeof createMigrationHarness>["client"],
  name: "0000_initial.sql" | "0001_installation.sql",
) => {
  client.exec(
    readFileSync(new URL(`../../drizzle/${name}`, import.meta.url), "utf8"),
  );
};

const setupEvents = (
  suffix: "1" | "2",
  email: string,
  userEventId = EventId.schema.parse(
    `71000000-0000-4000-8000-00000000000${suffix}`,
  ),
) => {
  const userId = UserId.schema.parse(
    `72000000-0000-4000-8000-00000000000${suffix}`,
  );
  const sessionId = SessionId.schema.parse(
    `73000000-0000-4000-8000-00000000000${suffix}`,
  );
  const sessionEventId = EventId.schema.parse(
    `74000000-0000-4000-8000-00000000000${suffix}`,
  );
  const passwordHash = PasswordHash.schema.parse(
    `scrypt$${suffix.repeat(22)}==$${suffix.repeat(86)}==`,
  );
  const tokenHash = SessionTokenHash.schema.parse(suffix.repeat(64));
  const userEvent = User.create({
    eventId: userEventId,
    occurredAt: now,
    actorUserId: userId,
  })({
    kind: "Admin",
    userId,
    email: UserEmail.schema.parse(email),
    name: UserName.schema.parse(`Admin ${suffix}`),
    passwordHash,
  });
  const sessionEvent = Session.create({
    eventId: sessionEventId,
    occurredAt: now,
    actorUserId: userId,
  })({ sessionId, userId, tokenHash, expiresAt });

  return { userEvent, sessionEvent, passwordHash, tokenHash } as const;
};

describe("SQLite initial Admin setup store", () => {
  test("backfills the installation claim when upgrading a database with an existing user", async () => {
    const { client, db } = createMigrationHarness();
    applyMigration(client, "0000_initial.sql");
    db.insert(usersTable)
      .values({
        userId: "70000000-0000-4000-8000-000000000001",
        role: "Admin",
        email: "existing@example.test",
        name: "Existing Admin",
        passwordHash: `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
        veterinarianId: null,
      })
      .run();

    applyMigration(client, "0001_installation.sql");
    applyMigration(client, "0001_installation.sql");

    const status = await createInstallationStatusQuery(db).get();
    const candidate = setupEvents("1", "new@example.test");
    const setup = await createInitialAdminSetupStore(db).store(
      candidate.userEvent,
      candidate.sessionEvent,
    );

    expect(status._unsafeUnwrap()).toEqual({ kind: "Installed" });
    expect(setup.isErr() && setup.error).toEqual({
      kind: "InitialAdminAlreadyExists",
    });
    expect(db.select().from(installationTable).all()).toHaveLength(1);
    expect(db.select().from(usersTable).all()).toHaveLength(1);
    expect(db.select().from(sessionsTable).all()).toEqual([]);
    expect(client.prepare("SELECT event_id FROM domain_events").all()).toEqual([]);
  });

  test("leaves a genuinely empty upgraded database available for setup", async () => {
    const { client, db } = createMigrationHarness();
    applyMigration(client, "0000_initial.sql");

    applyMigration(client, "0001_installation.sql");

    const status = await createInstallationStatusQuery(db).get();

    expect(status._unsafeUnwrap()).toEqual({
      kind: "InitialSetupAvailable",
    });
    expect(db.select().from(installationTable).all()).toEqual([]);
  });

  test("atomically lets exactly one concurrent setup claim the installation", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createInitialAdminSetupStore(db);
    const first = setupEvents("1", "first@example.test");
    const second = setupEvents("2", "second@example.test");

    const results = await Promise.all([
      store.store(first.userEvent, first.sessionEvent),
      store.store(second.userEvent, second.sessionEvent),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(
      results.filter((result) => result.isErr()).map((result) =>
        result.isErr() ? result.error : undefined,
      ),
    ).toEqual([{ kind: "InitialAdminAlreadyExists" }]);
    expect(db.select().from(installationTable).all()).toHaveLength(1);
    expect(db.select().from(usersTable).all()).toHaveLength(1);
    expect(db.select().from(sessionsTable).all()).toHaveLength(1);
    const events = db.select().from(domainEventsTable).all();
    expect(events).toHaveLength(2);
    expect(events.map(({ eventName }) => eventName).sort()).toEqual([
      "session.created",
      "user.created",
    ]);
    const serializedEvents = JSON.stringify(events);
    for (const sensitive of [
      "first@example.test",
      "second@example.test",
      first.passwordHash.unwrap(),
      second.passwordHash.unwrap(),
      first.tokenHash.unwrap(),
      second.tokenHash.unwrap(),
    ]) {
      expect(serializedEvents).not.toContain(sensitive);
    }
  });

  test("rolls back the marker and every projection when the session event insert fails", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const duplicateEventId = EventId.schema.parse(
      "75000000-0000-4000-8000-000000000001",
    );
    const fixture = setupEvents(
      "1",
      "rollback@example.test",
      duplicateEventId,
    );
    const sessionEvent = {
      ...fixture.sessionEvent,
      eventId: duplicateEventId,
    } as const;

    const result = await createInitialAdminSetupStore(db).store(
      fixture.userEvent,
      sessionEvent,
    );

    expect(result.isErr() && result.error.kind).toBe("RepositoryError");
    expect(db.select().from(installationTable).all()).toEqual([]);
    expect(db.select().from(usersTable).all()).toEqual([]);
    expect(db.select().from(sessionsTable).all()).toEqual([]);
    expect(db.select().from(domainEventsTable).all()).toEqual([]);
  });
});
