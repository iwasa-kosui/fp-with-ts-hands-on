import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { createApp, createApplicationDependencies } from "../../src/app.js";

const inertiaHeaders = { Accept: "application/json", "X-Inertia": "true", "X-Inertia-Version": "1" } as const;
const createHarness = () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  return createApp(createApplicationDependencies(database, {
    clock: { now: () => Timestamp.schema.parse("2026-08-09T01:30:00.000Z") }, isProduction: false,
  }));
};
const post = (app: ReturnType<typeof createHarness>, path: string, values: Record<string, string>) => app.request(path, {
  method: "POST", body: new URLSearchParams(values),
  headers: { ...inertiaHeaders, "Content-Type": "application/x-www-form-urlencoded", Origin: "http://localhost" },
});

describe("appointment calendar route", () => {
  test("normalizes an invalid date to today in JST and leaves an invalid view for the client to choose", async () => {
    const app = createHarness();
    const setup = await post(app, "/setup", { email: "admin@example.test", name: "管理者", password: "correct horse battery staple" });
    const cookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const response = await app.request("/appointments?date=2026-02-29&view=month", { headers: { ...inertiaHeaders, Cookie: cookie } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ component: "Appointments/Index", props: { date: "2026-08-09", requestedView: null } });
  });
});
