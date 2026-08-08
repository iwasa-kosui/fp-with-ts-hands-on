import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count, sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  domainEventsTable,
  installationTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const temporaryDirectories: string[] = [];
const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("file SQLite application smoke", () => {
  test("migrates a new file and persists first-admin setup through the real app", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "clinic.sqlite");
    const database = createSqliteDatabase(databasePath);

    migrateDatabase(database);
    migrateDatabase(database);

    expect(existsSync(databasePath)).toBe(true);
    expect(
      database
        .all<{ name: string }>(
          sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .map(({ name }) => name),
    ).toEqual(
      expect.arrayContaining([
        "__drizzle_migrations",
        "domain_events",
        "installation",
        "users",
      ]),
    );

    const now = Timestamp.schema.parse("2026-08-09T04:30:00.000Z");
    const app = createApp(
      createApplicationDependencies(database, {
        clock: { now: () => now },
        isProduction: false,
      }),
    );
    const beforeSetup = await app.request("/", { headers: inertiaHeaders });

    expect(beforeSetup.status).toBe(302);
    expect(beforeSetup.headers.get("location")).toBe("/setup");

    const setupResponse = await app.request("/setup", {
      method: "POST",
      body: new URLSearchParams({
        email: "admin@example.test",
        name: "Clinic Admin",
        password: "correct horse battery staple",
      }),
      headers: {
        ...inertiaHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "http://localhost",
      },
    });

    expect(setupResponse.status).toBe(302);
    expect(setupResponse.headers.get("location")).toBe("/");
    expect(database.select({ value: count() }).from(installationTable).get())
      .toEqual({ value: 1 });
    expect(database.select({ value: count() }).from(usersTable).get()).toEqual({
      value: 1,
    });
    expect(database.select({ value: count() }).from(domainEventsTable).get())
      .toEqual({ value: 2 });

    const secondConnection = createSqliteDatabase(databasePath);
    const persistedAdmin = secondConnection.select().from(usersTable).get();
    expect(persistedAdmin).toMatchObject({
      email: "admin@example.test",
      name: "Clinic Admin",
      role: "Admin",
    });
  });
});
