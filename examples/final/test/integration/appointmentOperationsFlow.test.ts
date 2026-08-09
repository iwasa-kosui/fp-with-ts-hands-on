import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
  domainEventsTable,
  ownersTable,
  petsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;
const admin = {
  email: "admin@example.test",
  name: "管理者",
  password: "correct horse battery staple",
} as const;
const receptionist = {
  email: "reception@example.test",
  name: "受付担当",
  password: "reception password value",
} as const;
const veterinarian = {
  email: "vet@example.test",
  name: "佐藤 獣医師",
  password: "veterinarian password value",
} as const;

const temporaryDirectories: string[] = [];
const databases: SqliteDatabase[] = [];

afterEach(() => {
  for (const database of databases.splice(0)) database.$client.close();
  for (const directory of temporaryDirectories.splice(0)) {
    if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
  }
});

const createHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-final-operations-"));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, "clinic.sqlite");
  const database = createSqliteDatabase(databasePath);
  databases.push(database);
  migrateDatabase(database);
  let currentTime = Timestamp.schema.parse("2026-08-10T02:30:00.000Z");
  const clock = { now: () => currentTime } as const;
  const app = createApp(createApplicationDependencies(database, {
    clock,
    isProduction: false,
  }));
  return {
    app,
    database,
    databasePath,
    setTime: (value: string) => {
      currentTime = Timestamp.schema.parse(value);
    },
  } as const;
};
type Harness = ReturnType<typeof createHarness>;

const cookiePair = (response: Response): string => {
  const cookie = response.headers.get("set-cookie");
  expect(cookie).not.toBeNull();
  return cookie?.split(";")[0] ?? "";
};
const post = (
  harness: Harness,
  path: string,
  values: Readonly<Record<string, string>>,
  cookie?: string,
) => harness.app.request(path, {
  method: "POST",
  body: new URLSearchParams(values),
  headers: {
    ...inertiaHeaders,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "http://localhost",
    ...(cookie === undefined ? {} : { Cookie: cookie }),
  },
});
const page = (harness: Harness, path: string, cookie: string) =>
  harness.app.request(path, { headers: { ...inertiaHeaders, Cookie: cookie } });
const setup = async (harness: Harness): Promise<string> =>
  cookiePair(await post(harness, "/setup", admin));
const login = async (
  harness: Harness,
  credentials: Readonly<{ email: string; password: string }>,
): Promise<string> => cookiePair(await post(harness, "/login", credentials));
const createUser = async (
  harness: Harness,
  adminCookie: string,
  values: Readonly<{
    email: string;
    name: string;
    password: string;
    role: "Receptionist" | "Veterinarian";
  }>,
) => {
  expect((await post(harness, "/users", values, adminCookie)).status).toBe(302);
  const row = harness.database.select().from(usersTable)
    .where(eq(usersTable.email, values.email)).get();
  expect(row).toBeDefined();
  if (row === undefined) throw new TypeError("user was not created");
  return row;
};
const createOwnerAndPet = async (harness: Harness, cookie: string) => {
  expect((await post(harness, "/owners", {
    name: "山田 花子",
    email: "hanako@example.test",
    phone: "090-1234-5678",
  }, cookie)).status).toBe(302);
  const owner = harness.database.select().from(ownersTable).get();
  if (owner === undefined) throw new TypeError("owner was not created");
  expect((await post(harness, "/pets", {
    ownerId: owner.ownerId,
    name: "むぎ",
    species: "Cat",
  }, cookie)).status).toBe(302);
  const pet = harness.database.select().from(petsTable).get();
  if (pet === undefined) throw new TypeError("pet was not created");
  return { owner, pet } as const;
};
const bookVaccination = async (
  harness: Harness,
  cookie: string,
  input: Readonly<{
    ownerId: string;
    petId: string;
    veterinarianId: string;
    scheduledAt: string;
    reason: string;
  }>,
) => {
  const response = await post(harness, "/appointments", {
    ownerId: input.ownerId,
    petId: input.petId,
    scheduledAt: input.scheduledAt,
    serviceCode: "Vaccination",
    durationMinutes: "15",
    assignedVeterinarianId: input.veterinarianId,
    reason: input.reason,
  }, cookie);
  expect(response.status).toBe(303);
  const location = response.headers.get("location");
  expect(location).toMatch(/^\/appointments\//);
  const appointmentId = location?.split("/").at(-1);
  if (appointmentId === undefined) throw new TypeError("appointment was not booked");
  return appointmentId;
};

describe("file SQLite appointment operations flow", () => {
  test("rejects invalid and sub-millisecond timestamps before conflict checks or any appointment audit write", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    const veterinarianRow = await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    if (veterinarianRow.veterinarianId === null) throw new TypeError("veterinarian id missing");
    const { owner, pet } = await createOwnerAndPet(harness, adminCookie);
    const bookedResponse = await post(harness, "/appointments", {
      ownerId: owner.ownerId,
      petId: pet.petId,
      scheduledAt: "2026-08-10T18:30:00+09:00",
      serviceCode: "GeneralConsultation",
      durationMinutes: "30",
      assignedVeterinarianId: veterinarianRow.veterinarianId,
      reason: "既存の予約",
    }, adminCookie);
    expect(bookedResponse.status).toBe(303);
    const existingAppointmentId = bookedResponse.headers.get("location")
      ?.split("/").at(-1) ?? "";
    expect(existingAppointmentId).not.toBe("");
    expect(harness.database.select().from(appointmentsTable)
      .where(eq(appointmentsTable.appointmentId, existingAppointmentId)).get()?.scheduledAt)
      .toBe("2026-08-10T09:30:00.000Z");
    const before = {
      appointments: harness.database.select().from(appointmentsTable).all(),
      events: harness.database.select().from(domainEventsTable).all(),
      regular: harness.database.select().from(domainEventPayloadsTable).all(),
      sensitive: harness.database.select().from(domainEventSensitivePayloadsTable).all(),
    };

    for (const scheduledAt of [
      "2026-08-10T12:00:00+99:99",
      "2026-08-10T10:00:00.0005Z",
    ]) {
      const rejected = await post(harness, "/appointments", {
        ownerId: owner.ownerId,
        petId: pet.petId,
        scheduledAt,
        serviceCode: "GeneralConsultation",
        durationMinutes: "30",
        assignedVeterinarianId: veterinarianRow.veterinarianId,
        reason: "競合を迂回してはいけない予約",
      }, adminCookie);

      expect(rejected.status).toBe(200);
      await expect(rejected.json()).resolves.toMatchObject({
        component: "Appointments/New",
        props: { errors: { scheduledAt: "入力内容を確認してください" } },
      });
      expect(harness.database.select().from(appointmentsTable).all()).toEqual(before.appointments);
      expect(harness.database.select().from(domainEventsTable).all()).toEqual(before.events);
      expect(harness.database.select().from(domainEventPayloadsTable).all()).toEqual(before.regular);
      expect(harness.database.select().from(domainEventSensitivePayloadsTable).all()).toEqual(before.sensitive);
    }

    const calendar = await page(
      harness,
      "/appointments?date=2026-08-10&view=day",
      adminCookie,
    );
    await expect(calendar.json()).resolves.toMatchObject({
      props: {
        appointments: [expect.objectContaining({ appointmentId: existingAppointmentId })],
      },
    });
  });

  test("rejects an administrator-selected missing or non-veterinarian ID without writing", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    const receptionistRow = await createUser(harness, adminCookie, {
      ...receptionist,
      role: "Receptionist",
    });
    const { owner, pet } = await createOwnerAndPet(harness, adminCookie);
    const booked = await post(harness, "/appointments", {
      ownerId: owner.ownerId,
      petId: pet.petId,
      scheduledAt: "2026-08-10T05:00:00.000Z",
      serviceCode: "GeneralConsultation",
      durationMinutes: "30",
      assignedVeterinarianId: "",
      reason: "担当医未定の診察",
    }, adminCookie);
    expect(booked.status).toBe(303);
    const appointmentId = booked.headers.get("location")?.split("/").at(-1);
    if (appointmentId === undefined) throw new TypeError("appointment was not booked");
    expect((await post(harness, `/appointments/${appointmentId}/check-in`, {
      expectedVersion: "1",
    }, adminCookie)).status).toBe(303);
    const before = {
      appointments: harness.database.select().from(appointmentsTable).all(),
      events: harness.database.select().from(domainEventsTable).all(),
      regular: harness.database.select().from(domainEventPayloadsTable).all(),
      sensitive: harness.database.select().from(domainEventSensitivePayloadsTable).all(),
    };

    for (const selectedId of [
      "7e000000-0000-4000-8000-000000000001",
      receptionistRow.userId,
    ]) {
      const rejected = await post(
        harness,
        `/appointments/${appointmentId}/start-examination`,
        { expectedVersion: "2", veterinarianId: selectedId },
        adminCookie,
      );
      expect(rejected.status).toBe(303);
      expect(rejected.headers.get("location")).toBe(
        `/appointments/${appointmentId}?error=veterinarian-not-found`,
      );
      const detail = await page(
        harness,
        rejected.headers.get("location") ?? "",
        adminCookie,
      );
      await expect(detail.json()).resolves.toMatchObject({
        props: {
          errors: {
            veterinarianId: "選択した担当獣医師が見つかりません。",
          },
        },
      });
      expect(harness.database.select().from(appointmentsTable).all())
        .toEqual(before.appointments);
      expect(harness.database.select().from(domainEventsTable).all())
        .toEqual(before.events);
      expect(harness.database.select().from(domainEventPayloadsTable).all())
        .toEqual(before.regular);
      expect(harness.database.select().from(domainEventSensitivePayloadsTable).all())
        .toEqual(before.sensitive);
    }
    expect(before.appointments).toEqual([
      expect.objectContaining({
        appointmentId,
        assignedVeterinarianId: null,
        status: "CheckedIn",
        version: 2,
      }),
    ]);
  });

  test("runs assigned vaccination through refund settlement, cancellation, audit reveal, and both operational read models", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    await createUser(harness, adminCookie, { ...receptionist, role: "Receptionist" });
    const veterinarianRow = await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    if (veterinarianRow.veterinarianId === null) throw new TypeError("veterinarian id missing");
    const receptionistCookie = await login(harness, receptionist);
    const veterinarianCookie = await login(harness, veterinarian);
    const { owner, pet } = await createOwnerAndPet(harness, receptionistCookie);

    const paidAppointmentId = await bookVaccination(harness, receptionistCookie, {
      ownerId: owner.ownerId,
      petId: pet.petId,
      veterinarianId: veterinarianRow.veterinarianId,
      scheduledAt: "2026-08-10T03:00:00.000Z",
      reason: "予防接種",
    });
    const overlap = await post(harness, "/appointments", {
      ownerId: owner.ownerId,
      petId: pet.petId,
      scheduledAt: "2026-08-10T03:10:00.000Z",
      serviceCode: "Vaccination",
      durationMinutes: "15",
      assignedVeterinarianId: veterinarianRow.veterinarianId,
      reason: "重複する予約",
    }, receptionistCookie);
    expect(overlap.status).toBe(200);
    await expect(overlap.json()).resolves.toMatchObject({
      component: "Appointments/New",
      props: {
        errors: {
          assignedVeterinarianId: "選択した時間帯には、この獣医師の別の予約があります。",
        },
      },
    });

    expect((await post(harness, `/appointments/${paidAppointmentId}/deposit`, {
      expectedVersion: "1",
      depositAmount: "8000",
    }, receptionistCookie)).status).toBe(303);
    expect((await post(harness, `/appointments/${paidAppointmentId}/check-in`, {
      expectedVersion: "2",
    }, receptionistCookie)).status).toBe(303);
    harness.setTime("2026-08-10T03:02:00.000Z");
    expect((await post(harness, `/appointments/${paidAppointmentId}/start-examination`, {
      expectedVersion: "3",
    }, veterinarianCookie)).status).toBe(303);
    harness.setTime("2026-08-10T03:10:00.000Z");
    expect((await post(harness, `/appointments/${paidAppointmentId}/exam-results`, {
      expectedVersion: "4",
      petId: pet.petId,
      collectedAt: "2026-08-10T03:10:00.000Z",
      item: "予防接種後の状態は良好",
      needsFollowUp: "false",
    }, veterinarianCookie)).status).toBe(303);
    harness.setTime("2026-08-10T03:15:00.000Z");
    expect((await post(harness, `/appointments/${paidAppointmentId}/payment`, {
      expectedVersion: "5",
      diagnosis: "接種可能",
      treatment: "ワクチン接種",
      finalAmount: "5000",
    }, receptionistCookie)).status).toBe(303);
    const paidDetail = await page(harness, `/appointments/${paidAppointmentId}`, receptionistCookie);
    await expect(paidDetail.json()).resolves.toMatchObject({
      props: {
        appointment: {
          kind: "Paid",
          version: 6,
          settlement: {
            kind: "Settled",
            depositAmount: 8000,
            finalAmount: 5000,
            refundAmount: 3000,
            additionalPaymentAmount: 0,
          },
        },
      },
    });

    const canceledAppointmentId = await bookVaccination(harness, receptionistCookie, {
      ownerId: owner.ownerId,
      petId: pet.petId,
      veterinarianId: veterinarianRow.veterinarianId,
      scheduledAt: "2026-08-10T04:00:00.000Z",
      reason: "キャンセル対象の予防接種",
    });
    expect((await post(harness, `/appointments/${canceledAppointmentId}/deposit`, {
      expectedVersion: "1",
      depositAmount: "6000",
    }, receptionistCookie)).status).toBe(303);
    expect((await post(harness, `/appointments/${canceledAppointmentId}/cancel`, {
      expectedVersion: "2",
      reason: "飼い主都合",
    }, receptionistCookie)).status).toBe(303);
    const canceledDetail = await page(
      harness,
      `/appointments/${canceledAppointmentId}`,
      receptionistCookie,
    );
    await expect(canceledDetail.json()).resolves.toMatchObject({
      props: {
        appointment: {
          kind: "Canceled",
          version: 3,
          settlement: {
            kind: "DepositRefunded",
            depositAmount: 6000,
          },
        },
      },
    });
    const canceledEvent = harness.database.select().from(domainEventsTable)
      .where(eq(domainEventsTable.eventName, "appointment.canceled")).get();
    expect(canceledEvent).toBeDefined();
    expect(harness.database.select().from(domainEventSensitivePayloadsTable)
      .where(eq(domainEventSensitivePayloadsTable.eventId, canceledEvent?.eventId ?? "")).get())
      .toMatchObject({ eventPayload: { refundAmount: 6000 } });

    const eventsBeforeReveal = await page(harness, "/events", adminCookie);
    const eventsPage = await eventsBeforeReveal.json();
    const examEvent = eventsPage.props.events.find(
      (event: Readonly<{ eventName: string }>) => event.eventName === "exam-result.recorded",
    );
    expect(examEvent).toBeDefined();
    const reveal = await post(
      harness,
      `/events/${String(examEvent?.eventId)}/sensitive-payload`,
      {},
      adminCookie,
    );
    expect(reveal.status).toBe(200);
    expect(await reveal.text()).toContain("予防接種後の状態は良好");
    expect(
      harness.database.select().from(domainEventsTable)
        .where(eq(domainEventsTable.eventName, "audit.sensitive-payload-viewed")).all(),
    ).toHaveLength(1);
    expect(
      harness.database.select().from(domainEventPayloadsTable).all()
        .some(({ eventPayload }) => JSON.stringify(eventPayload).includes(String(examEvent?.eventId))),
    ).toBe(true);

    const calendar = await page(
      harness,
      "/appointments?date=2026-08-10&view=day&canceled=1",
      receptionistCookie,
    );
    const calendarPage = await calendar.json();
    expect(calendarPage.props.appointments).toEqual(expect.arrayContaining([
      expect.objectContaining({ appointmentId: paidAppointmentId, appointmentStatus: "Paid", settlementStatus: "Settled" }),
      expect.objectContaining({ appointmentId: canceledAppointmentId, appointmentStatus: "Canceled", settlementStatus: "DepositRefunded" }),
    ]));
    const reception = await page(harness, "/reception", receptionistCookie);
    const receptionPage = await reception.json();
    expect(receptionPage.props.board.paid).toEqual(expect.arrayContaining([
      expect.objectContaining({ appointmentId: paidAppointmentId, appointmentStatus: "Paid", settlementStatus: "Settled" }),
    ]));
    expect(receptionPage.props.board.canceled).toEqual(expect.arrayContaining([
      expect.objectContaining({ appointmentId: canceledAppointmentId, appointmentStatus: "Canceled", settlementStatus: "DepositRefunded" }),
    ]));

    const secondConnection = createSqliteDatabase(harness.databasePath);
    databases.push(secondConnection);
    expect(secondConnection.select().from(appointmentsTable).all()).toHaveLength(2);
  });

  test("rejects a settlement submitted from the second stale detail view without leaking the submitted values", async () => {
    const harness = createHarness();
    const adminCookie = await setup(harness);
    const veterinarianRow = await createUser(harness, adminCookie, {
      ...veterinarian,
      role: "Veterinarian",
    });
    if (veterinarianRow.veterinarianId === null) throw new TypeError("veterinarian id missing");
    const veterinarianCookie = await login(harness, veterinarian);
    const { owner, pet } = await createOwnerAndPet(harness, adminCookie);
    const appointmentId = await bookVaccination(harness, adminCookie, {
      ownerId: owner.ownerId,
      petId: pet.petId,
      veterinarianId: veterinarianRow.veterinarianId,
      scheduledAt: "2026-08-10T05:00:00.000Z",
      reason: "競合検証",
    });
    expect((await post(harness, `/appointments/${appointmentId}/check-in`, {
      expectedVersion: "1",
    }, adminCookie)).status).toBe(303);
    expect((await post(harness, `/appointments/${appointmentId}/start-examination`, {
      expectedVersion: "2",
    }, veterinarianCookie)).status).toBe(303);
    expect((await post(harness, `/appointments/${appointmentId}/exam-results`, {
      expectedVersion: "3",
      petId: pet.petId,
      collectedAt: "2026-08-10T03:00:00.000Z",
      item: "競合前の診察結果",
      needsFollowUp: "false",
    }, veterinarianCookie)).status).toBe(303);

    const firstDetail = await (await page(harness, `/appointments/${appointmentId}`, adminCookie)).json();
    const secondDetail = await (await page(harness, `/appointments/${appointmentId}`, adminCookie)).json();
    expect(firstDetail.props.appointment.version).toBe(4);
    expect(secondDetail.props.appointment.version).toBe(4);
    expect((await post(harness, `/appointments/${appointmentId}/reception-note`, {
      expectedVersion: String(firstDetail.props.appointment.version),
      receptionNote: "先に保存した受付メモ",
    }, adminCookie)).status).toBe(303);

    const stale = await post(harness, `/appointments/${appointmentId}/payment`, {
      expectedVersion: String(secondDetail.props.appointment.version),
      diagnosis: "レスポンスへ出してはいけない診断",
      treatment: "レスポンスへ出してはいけない処置",
      finalAmount: "4000",
    }, adminCookie);
    expect(stale.status).toBe(303);
    expect(stale.headers.get("location")).toBe(
      `/appointments/${appointmentId}?error=settlement-conflict`,
    );
    const conflict = await page(harness, stale.headers.get("location") ?? "", adminCookie);
    const conflictBody = await conflict.text();
    expect(conflictBody).toContain("会計情報が更新されています。金額を確認し直してください。");
    expect(conflictBody).not.toContain("レスポンスへ出してはいけない診断");
    expect(conflictBody).not.toContain("レスポンスへ出してはいけない処置");
    expect(harness.database.select().from(appointmentsTable)
      .where(eq(appointmentsTable.appointmentId, appointmentId)).get()).toMatchObject({
        status: "AwaitingPayment",
        version: 5,
      });
    expect(harness.database.select().from(domainEventsTable)
      .where(eq(domainEventsTable.eventName, "appointment.final-settlement-recorded")).all()).toHaveLength(0);
  });
});
