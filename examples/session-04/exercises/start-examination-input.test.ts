import { readFileSync } from "node:fs";

import { getTableColumns } from "drizzle-orm";
import { Hono } from "hono";
import { describe, expect, expectTypeOf, it } from "vitest";

import { clinicFixture } from "../../fixtures/clinic.js";
import {
  createAppointmentRepository,
  type AppointmentRepository,
} from "../src/adaptor/secondary/sqlite/appointmentRepository.js";
import type { SqliteDatabase } from "../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  auditLogsTable,
} from "../src/adaptor/secondary/sqlite/schema.js";
import {
  StartExaminationInput,
  type StartExaminationInput as StartExaminationInputValue,
} from "../src/boundary/startExaminationInput.js";
import {
  registerClinicRoutes,
  session04InitialAppointment,
} from "../src/web/routes.js";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const post = (
  app: Hono,
  path: string,
  body?: unknown,
) => body === undefined
  ? app.request(path, { method: "POST", headers: inertiaHeaders })
  : app.request(path, {
      method: "POST",
      headers: { ...inertiaHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

type Row = Readonly<Record<string, unknown>>;

const createMemoryDatabase = (): SqliteDatabase => {
  let appointmentRow: Row | undefined;
  const auditRows: Row[] = [];
  const project = (fields: Row | undefined, row: Row | undefined): Row | undefined =>
    row === undefined
      ? undefined
      : fields === undefined
        ? row
        : Object.fromEntries(Object.keys(fields).map((key) => [key, row[key]]));

  const database = {
    delete: (table: unknown) => ({
      run: () => {
        if (table === appointmentsTable) appointmentRow = undefined;
        if (table === auditLogsTable) auditRows.splice(0);
      },
    }),
    insert: (table: unknown) => ({
      values: (row: Row) => {
        const write = () => {
          if (table === appointmentsTable) appointmentRow = row;
          if (table === auditLogsTable) auditRows.push(row);
        };
        return {
          onConflictDoUpdate: ({ set }: Readonly<{ set: Row }>) => ({
            run: () => {
              appointmentRow = set;
            },
          }),
          run: write,
        };
      },
    }),
    select: (fields?: Row) => ({
      from: (table: unknown) => ({
        get: () => table === appointmentsTable
          ? project(fields, appointmentRow)
          : project(fields, auditRows[0]),
        orderBy: () => ({ all: () => auditRows.map((row) => project(fields, row)) }),
        where: () => ({
          get: () => table === appointmentsTable
            ? project(fields, appointmentRow)
            : project(fields, auditRows[0]),
        }),
      }),
    }),
    transaction: (run: (transaction: SqliteDatabase) => unknown) =>
      run(database as SqliteDatabase),
  } as unknown as SqliteDatabase;

  return database;
};

const createTestApp = () => {
  const repository = createAppointmentRepository(createMemoryDatabase());
  Reflect.apply(repository.reset, repository, [
    session04InitialAppointment,
    { ownerContact: clinicFixture.ownerContact },
  ]);
  const app = new Hono();
  registerClinicRoutes(app, repository);
  return { app, repository };
};

const observe = (repository: AppointmentRepository) => ({
  appointment: repository.find(clinicFixture.appointmentId),
  auditLogs: repository.listAuditLogs(),
});

const validationIssuesOf = (result: unknown): unknown => {
  if (typeof result !== "object" || result === null) return undefined;
  const unwrap = Reflect.get(result, "_unsafeUnwrapErr");
  return typeof unwrap === "function" ? Reflect.apply(unwrap, result, []) : undefined;
};

describe("Step 1: 外部入力を検証して問題を残す", () => {
  it("正しい予約IDと獣医師IDを型付き入力へ変換する", () => {
    const result = StartExaminationInput.parse({
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
    });

    expect(result.isOk()).toBe(true);
    expectTypeOf(result._unsafeUnwrap()).toMatchTypeOf<StartExaminationInputValue>();
  });

  it("不正な2項目を拒否し、両方のpathを残す", () => {
    const result = StartExaminationInput.parse({
      appointmentId: "not-an-appointment-id",
      veterinarianId: "night-shift",
    });

    expect(result.isErr()).toBe(true);
    expect(validationIssuesOf(result)).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ["appointmentId"] }),
      expect.objectContaining({ path: ["veterinarianId"] }),
    ]));
  });
});

describe("Step 2: 不正なHTTP要求を副作用の前で止める", () => {
  it("不正な獣医師IDへ422と問題のpathを返す", async () => {
    const { app } = createTestApp();
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/check-in`);
    const response = await post(app, `${appointmentUrl}/start-examination`, {
      veterinarianId: "night-shift",
    });

    expect(response.status).toBe(422);
    if (response.status === 422) {
      expect(await response.json()).toEqual({
        issues: expect.arrayContaining([
          expect.objectContaining({ path: ["veterinarianId"] }),
        ]),
      });
    }
  });

  it("不正な獣医師IDでは予約状態と監査記録を変更しない", async () => {
    const { app, repository } = createTestApp();
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/check-in`);
    const before = observe(repository);
    await post(app, `${appointmentUrl}/start-examination`, {
      veterinarianId: "night-shift",
    });

    expect(observe(repository)).toEqual(before);
  });
});

describe("Step 3: 保存する情報を用途に必要な項目へ絞る", () => {
  it("診察開始の監査データを3項目だけにする", async () => {
    const { app, repository } = createTestApp();
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`, {
      veterinarianId: clinicFixture.veterinarianId,
    });

    expect(observe(repository).auditLogs.at(-1)).toMatchObject({
      eventName: "ExaminationStarted",
      payload: {
        appointmentId: clinicFixture.appointmentId,
        veterinarianId: clinicFixture.veterinarianId,
        examinationStartedAt: "2026-08-30T06:30:00.000Z",
      },
    });
    expect(observe(repository).auditLogs.at(-1)?.payload).toEqual({
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
    });
  });

  it("初期監査には予約IDだけを保存する", () => {
    const { repository } = createTestApp();
    expect(observe(repository).auditLogs[0]).toMatchObject({
      eventName: "AppointmentSeeded",
      payload: { appointmentId: clinicFixture.appointmentId },
    });
    expect(observe(repository).auditLogs[0]?.payload).toEqual({
      appointmentId: clinicFixture.appointmentId,
    });
  });

  it("予約テーブルに利用しない飼い主連絡先を保存しない", () => {
    const columns = getTableColumns(appointmentsTable);
    const migration = readFileSync(
      new URL("../drizzle/0000_initial.sql", import.meta.url),
      "utf8",
    );

    expect(columns).not.toHaveProperty("ownerContact");
    expect(migration).not.toContain("owner_contact");
  });
});
