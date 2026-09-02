import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import type { Hono } from "hono";
import { afterEach, expect, test } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import * as session07App from "../../src/app.js";
import type { AppointmentPersistenceError } from "../../src/adaptor/secondary/sqlite/appointmentPersistenceError.js";
import { createSqliteDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { createExaminationStartedStore } from "../../src/adaptor/secondary/sqlite/examinationStartedStore.js";
import type { Clock } from "../../src/domain/aggregate/clock.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventIdGenerator } from "../../src/domain/aggregate/eventIdGenerator.js";
import {
  Appointment,
  AppointmentId,
  checkIn,
  VeterinarianId,
} from "../../src/domain/appointment/index.js";
import { startExaminationWithEffects } from "../../src/useCase/startExamination.js";
import { session07InitialAppointment } from "../../src/web/routes.js";
import { ZodError } from "zod";

const directories: string[] = [];
const eventId = EventId.parse("77777777-7777-4777-8777-777777777777");
const occurredAt = "2026-08-30T08:00:00.000Z";

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

type DatabaseBackedApp = Hono & Readonly<{ close: () => void }>;
type DatabaseBackedAppOptions = Readonly<{
  clock: Clock;
  databasePath: string;
  eventIdGenerator: EventIdGenerator;
  isProduction: boolean;
  migrationsFolder: string;
}>;
type DatabaseBackedAppFactory = (
  options: DatabaseBackedAppOptions,
) => DatabaseBackedApp;

const createDatabaseBackedApp = Reflect.get(
  session07App,
  "createDatabaseBackedApp",
) as DatabaseBackedAppFactory;

const createOptions = (): DatabaseBackedAppOptions => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-07-"));
  directories.push(directory);

  return {
    clock: { now: () => occurredAt },
    databasePath: join(directory, "clinic.sqlite"),
    eventIdGenerator: { generate: () => eventId },
    isProduction: false,
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  };
};

const post = (
  app: DatabaseBackedApp,
  path: string,
  body: unknown = path.endsWith("/start-examination")
    ? { veterinarianId: clinicFixture.veterinarianId }
    : undefined,
) => body === undefined
  ? app.request(path, { method: "POST", headers: inertiaHeaders })
  : app.request(path, {
      method: "POST",
      headers: { ...inertiaHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

const observe = (databasePath: string) => {
  const database = new Database(databasePath, { readonly: true });
  try {
    const appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    const audits = database
      .prepare(
        "SELECT event_id AS eventId, occurred_at AS occurredAt, payload FROM audit_logs WHERE event_name = 'ExaminationStarted'",
      )
      .all() as ReadonlyArray<
      Readonly<{ eventId: string; occurredAt: string; payload: string }>
    >;
    const auditCount = database
      .prepare("SELECT count(*) AS count FROM audit_logs")
      .get() as Readonly<{ count: number }>;

    return {
      appointment: JSON.parse(appointment.state),
      auditCount: auditCount.count,
      audits,
    };
  } finally {
    database.close();
  }
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("file SQLite persists the injected event ID and clock value", async () => {
  const options = createOptions();
  const app = createDatabaseBackedApp(options);
  try {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect(
      (await post(app, `${appointmentUrl}/start-examination`)).status,
    ).toBe(303);
  } finally {
    app.close();
  }

  expect(observe(options.databasePath)).toMatchObject({
    appointment: { kind: "InExamination" },
    audits: [{ eventId, occurredAt }],
  });
});

test("SQLite audit payload excludes appointment details that are not part of the audit DTO", async () => {
  const options = createOptions();
  const contactSentinel = "owner-contact: example@example.test";
  const app = createDatabaseBackedApp(options);
  app.close();

  const database = createSqliteDatabase(options.databasePath);
  try {
    const store = createExaminationStartedStore(
      database,
      session07InitialAppointment,
    );
    const checkedIn = {
      ...checkIn(session07InitialAppointment, clinicFixture.checkedInAt),
      reason: contactSentinel,
    };
    store.save(checkedIn);
    const event = Appointment.startExamination({ eventId, occurredAt })(
      checkedIn,
      VeterinarianId.parse(clinicFixture.veterinarianId),
    );

    expect((await store.store(event)).isOk()).toBe(true);
  } finally {
    database.close();
  }

  const audit = observe(options.databasePath).audits[0];
  expect(audit === undefined ? undefined : JSON.parse(audit.payload)).toEqual({
    appointmentId: clinicFixture.appointmentId,
    examinationStartedAt: occurredAt,
    veterinarianId: clinicFixture.veterinarianId,
  });
  expect(audit?.payload).not.toContain(contactSentinel);
});

test("SQLite audit failure returns 500 and rolls back the started state", async () => {
  const options = createOptions();
  const initialApp = createDatabaseBackedApp(options);
  initialApp.close();

  const triggerDatabase = new Database(options.databasePath);
  try {
    triggerDatabase.exec(`
      CREATE TRIGGER fail_examination_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.event_name = 'ExaminationStarted'
      BEGIN
        SELECT RAISE(FAIL, 'forced audit failure');
      END;
    `);
  } finally {
    triggerDatabase.close();
  }

  const app = createDatabaseBackedApp(options);
  try {
    const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect(
      (await post(app, `${appointmentUrl}/start-examination`)).status,
    ).toBe(500);
  } finally {
    app.close();
  }

  expect(observe(options.databasePath)).toMatchObject({
    appointment: { kind: "CheckedIn" },
    auditCount: 1,
    audits: [],
  });
});

test("the SQLite store returns a business conflict after the current row has changed", async () => {
  const options = createOptions();
  const seededApp = createDatabaseBackedApp(options);
  seededApp.close();

  const database = createSqliteDatabase(options.databasePath);
  try {
    const store = createExaminationStartedStore(
      database,
      session07InitialAppointment,
    );
    const checkedIn = checkIn(
      session07InitialAppointment,
      clinicFixture.checkedInAt,
    );
    store.save(checkedIn);
    const event = Appointment.startExamination({ eventId, occurredAt })(
      checkedIn,
      VeterinarianId.parse(clinicFixture.veterinarianId),
    );

    expect((await store.store(event)).isOk()).toBe(true);
    await expect(store.store(event)).resolves.toMatchObject({
      error: {
        kind: "AppointmentConflict",
        appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
      },
    });
  } finally {
    database.close();
  }
});

test("the SQLite store preserves the current CheckedIn fields when it commits a stale event", async () => {
  const options = createOptions();
  const seededApp = createDatabaseBackedApp(options);
  seededApp.close();

  const database = createSqliteDatabase(options.databasePath);
  try {
    const store = createExaminationStartedStore(
      database,
      session07InitialAppointment,
    );
    const staleCheckedIn = checkIn(
      session07InitialAppointment,
      "2026-08-30T06:00:00.000Z",
    );
    const staleEvent = Appointment.startExamination({ eventId, occurredAt })(
      staleCheckedIn,
      VeterinarianId.parse(clinicFixture.veterinarianId),
    );
    const currentCheckedIn = {
      ...checkIn(session07InitialAppointment, "2026-08-30T06:15:00.000Z"),
      reason: "updated reason from CheckedIn B",
    };
    store.save(currentCheckedIn);

    expect((await store.store(staleEvent)).isOk()).toBe(true);
  } finally {
    database.close();
  }

  expect(observe(options.databasePath).appointment).toMatchObject({
    checkedInAt: "2026-08-30T06:15:00.000Z",
    examinationStartedAt: occurredAt,
    kind: "InExamination",
    reason: "updated reason from CheckedIn B",
    veterinarianId: clinicFixture.veterinarianId,
  });
});

test("corrupt persisted state rejects the effectful use case as a ZodError", async () => {
  const options = createOptions();
  const seededApp = createDatabaseBackedApp(options);
  seededApp.close();

  const corruptingDatabase = new Database(options.databasePath);
  try {
    corruptingDatabase
      .prepare("UPDATE appointments SET state = ? WHERE appointment_id = ?")
      .run("{", clinicFixture.appointmentId);
  } finally {
    corruptingDatabase.close();
  }

  const database = createSqliteDatabase(options.databasePath);
  try {
    const store = createExaminationStartedStore(
      database,
      session07InitialAppointment,
    );

    await expect(
      startExaminationWithEffects({
        clock: { now: () => occurredAt },
        eventIdGenerator: { generate: () => eventId },
        resolver: store,
        store,
      })({
        appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
        veterinarianId: VeterinarianId.parse(clinicFixture.veterinarianId),
      }),
    ).rejects.toBeInstanceOf(ZodError);
  } finally {
    database.close();
  }
});

test("the SQLite store rejects audit failures instead of returning a business result", async () => {
  const options = createOptions();
  const seededApp = createDatabaseBackedApp(options);
  seededApp.close();

  const triggerDatabase = new Database(options.databasePath);
  try {
    triggerDatabase.exec(`
      CREATE TRIGGER fail_examination_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.event_name = 'ExaminationStarted'
      BEGIN
        SELECT RAISE(FAIL, 'forced audit failure');
      END;
    `);
  } finally {
    triggerDatabase.close();
  }

  const database = createSqliteDatabase(options.databasePath);
  try {
    const store = createExaminationStartedStore(
      database,
      session07InitialAppointment,
    );
    const checkedIn = checkIn(
      session07InitialAppointment,
      clinicFixture.checkedInAt,
    );
    store.save(checkedIn);
    const event = Appointment.startExamination({ eventId, occurredAt })(
      checkedIn,
      VeterinarianId.parse(clinicFixture.veterinarianId),
    );

    await expect(store.store(event)).rejects.toMatchObject({
      kind: "AppointmentPersistenceError",
      operation: "append-audit",
    } satisfies Partial<AppointmentPersistenceError>);
  } finally {
    database.close();
  }

  expect(observe(options.databasePath)).toMatchObject({
    appointment: { kind: "CheckedIn" },
    auditCount: 1,
    audits: [],
  });
});
