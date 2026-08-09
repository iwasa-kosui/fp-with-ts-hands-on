import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable, ownersTable, petsTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { createApp, createApplicationDependencies } from "../../src/app.js";

const inertiaHeaders = { Accept: "application/json", "X-Inertia": "true", "X-Inertia-Version": "1" } as const;
const post = (app: ReturnType<typeof createApp>, path: string, values: Record<string, string>) => app.request(path, { method: "POST", body: new URLSearchParams(values), headers: { ...inertiaHeaders, "Content-Type": "application/x-www-form-urlencoded", Origin: "http://localhost" } });

describe("reception board route", () => {
  test("renders the server-clock JST board for an authenticated user with an exact safe DTO", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const clock = { now: () => Timestamp.schema.parse("2026-08-09T03:00:00.000Z") } as const;
    const app = createApp(createApplicationDependencies(database, { clock, isProduction: false }));
    const setup = await post(app, "/setup", { email: "admin@example.test", name: "管理者", password: "correct horse battery staple" });
    const cookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const ownerId = "94000000-0000-4000-8000-000000000001";
    const petId = "94000000-0000-4000-8000-000000000002";
    database.insert(ownersTable).values({ ownerId, name: "山田 花子", email: "secret@example.test", phone: "090-0000-0000" }).run();
    database.insert(petsTable).values({ petId, ownerId, name: "むぎ", species: "Cat" }).run();
    database.insert(appointmentsTable).values({ appointmentId: "94000000-0000-4000-8000-000000000003", status: "Scheduled", ownerId, petId, scheduledAt: "2026-08-09T01:00:00.000Z", durationMinutes: 30, serviceCode: "GeneralConsultation", bookingKind: "Reserved", assignedVeterinarianId: null, receptionNote: "秘密の受付本文", settlementStatus: "NoPayment", depositAmount: null, version: 1, state: { kind: "Scheduled", visitReason: "秘密の来院理由" } }).run();

    const response = await app.request("/reception", { headers: { ...inertiaHeaders, Cookie: cookie } });
    const page = await response.json();

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ component: "Reception/Index", props: { currentTime: "2026-08-09T03:00:00.000Z", board: { businessDate: "2026-08-09", loadedAt: "2026-08-09T03:00:00.000Z", scheduled: [{ primaryAction: "CheckIn" }] } } });
    expect(Object.keys(page.props.board.scheduled[0]).sort()).toEqual([
      "appointmentId", "appointmentStatus", "assignedVeterinarianName", "bookingKind", "checkedInAt", "ownerName", "petName", "primaryAction", "scheduledAt", "serviceCode", "settlementStatus", "version", "waitingMinutes",
    ]);
    expect(JSON.stringify(page.props.board)).not.toMatch(/秘密の受付|秘密の来院|secret@example|090-/);
  });

  test("requires authentication", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const app = createApp(createApplicationDependencies(database, { clock: { now: () => Timestamp.schema.parse("2026-08-09T03:00:00.000Z") }, isProduction: false }));
    expect((await app.request("/reception", { headers: inertiaHeaders })).status).toBe(302);
  });
});
