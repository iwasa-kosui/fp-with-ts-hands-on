import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable, ownersTable, petsTable, usersTable } from "../../src/adaptor/secondary/sqlite/schema.js";
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
    await expect(response.json()).resolves.toMatchObject({ component: "Appointments/Index", props: { date: "2026-08-09", today: "2026-08-09", requestedView: null } });
  });

  test("allows a manager to open the walk-in form from the calendar action", async () => {
    const app = createHarness();
    const setup = await post(app, "/setup", { email: "admin@example.test", name: "管理者", password: "correct horse battery staple" });
    const cookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";

    const response = await app.request("/reception/walk-ins/new", { headers: { ...inertiaHeaders, Cookie: cookie } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ component: "Reception/WalkIn" });
  });

  test("allows only listed veterinarians, applies canceled filtering, and sends the exact safe calendar DTO", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    const dependencies = createApplicationDependencies(database, {
      clock: { now: () => Timestamp.schema.parse("2026-08-09T01:30:00.000Z") }, isProduction: false,
    });
    const app = createApp(dependencies);
    const setup = await post(app, "/setup", { email: "admin@example.test", name: "管理者", password: "correct horse battery staple" });
    const cookie = setup.headers.get("set-cookie")?.split(";")[0] ?? "";
    const admin = database.select().from(usersTable).all().find((user) => user.email === "admin@example.test");
    if (admin === undefined) throw new Error("初期管理者が作成されませんでした");
    const ownerId = "90000000-0000-4000-8000-000000000001";
    const petId = "90000000-0000-4000-8000-000000000002";
    const veterinarianId = "90000000-0000-4000-8000-000000000003";
    database.insert(ownersTable).values({ ownerId, name: "表示禁止の飼い主", email: "owner@example.test", phone: "090-0000-0000" }).run();
    database.insert(petsTable).values({ petId, ownerId, name: "むぎ", species: "Cat" }).run();
    database.insert(usersTable).values({ userId: "90000000-0000-4000-8000-000000000004", role: "Veterinarian", email: "vet@example.test", name: "佐藤 獣医師", passwordHash: admin.passwordHash, veterinarianId }).run();
    const base = {
      ownerId, petId, scheduledAt: "2026-08-09T01:00:00.000Z", durationMinutes: 30,
      serviceCode: "GeneralConsultation" as const, bookingKind: "Reserved" as const, assignedVeterinarianId: veterinarianId,
      receptionNote: "表示禁止の受付メモ", settlementStatus: "NoPayment" as const, depositAmount: null, version: 1,
    };
    database.insert(appointmentsTable).values({ ...base, appointmentId: "90000000-0000-4000-8000-000000000005", status: "Scheduled", state: { kind: "Scheduled" } }).run();
    database.insert(appointmentsTable).values({ ...base, appointmentId: "90000000-0000-4000-8000-000000000006", status: "Canceled", state: { kind: "Canceled" } }).run();
    const visible = await app.request(`/appointments?date=2026-08-09&view=day&veterinarianId=${veterinarianId}`, { headers: { ...inertiaHeaders, Cookie: cookie } });
    const visibleText = await visible.text();
    expect(visible.status).toBe(200);
    const visiblePage = JSON.parse(visibleText);
    expect(visiblePage).toMatchObject({ props: { selectedVeterinarianId: veterinarianId, includeCanceled: false } });
    expect(visiblePage.props.appointments).toHaveLength(1);
    expect(Object.keys(visiblePage.props.appointments[0]).sort()).toEqual([
      "appointmentId", "appointmentStatus", "assignedVeterinarianId", "assignedVeterinarianName", "bookingKind", "durationMinutes", "endsAt", "petName", "serviceCode", "settlementStatus", "startsAt",
    ]);
    expect(JSON.stringify(visiblePage.props.appointments)).not.toContain("表示禁止");
    expect(JSON.stringify(visiblePage.props.appointments)).not.toMatch(/owner|reason|note/i);

    const canceled = await app.request(`/appointments?date=2026-08-09&view=day&veterinarianId=${veterinarianId}&canceled=1`, { headers: { ...inertiaHeaders, Cookie: cookie } });
    await expect(canceled.json()).resolves.toMatchObject({ props: { selectedVeterinarianId: veterinarianId, includeCanceled: true, appointments: expect.arrayContaining([expect.objectContaining({ appointmentStatus: "Canceled" })]) } });

    const invalid = await app.request("/appointments?date=2026-08-09&view=day&veterinarianId=90000000-0000-4000-8000-000000000099", { headers: { ...inertiaHeaders, Cookie: cookie } });
    await expect(invalid.json()).resolves.toMatchObject({ props: { selectedVeterinarianId: null, includeCanceled: false } });
  });
});
