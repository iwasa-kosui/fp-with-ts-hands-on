import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import type { Hono } from "hono";
import { afterEach, expect, test } from "vitest";
import { ZodError } from "zod";

import { clinicFixture } from "../../../fixtures/clinic.js";
import * as session06App from "../../src/app.js";
import type {
  AppointmentPersistenceError,
} from "../../src/adaptor/secondary/sqlite/appointmentPersistenceError.js";
import {
  createAppointmentStore,
} from "../../src/adaptor/secondary/sqlite/appointmentStore.js";
import {
  createSqliteDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import {
  Appointment,
  AppointmentId,
  checkIn,
  VeterinarianId,
} from "../../src/domain/appointment/index.js";
import { startExaminationWithEffects } from "../../src/useCase/startExamination.js";
import { session06InitialAppointment } from "../../src/web/routes.js";

const directories: string[] = [];

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

type DatabaseBackedApp = Hono & Readonly<{ close: () => void }>;
type DatabaseBackedAppOptions = Readonly<{
  databasePath: string;
  migrationsFolder: string;
  isProduction: boolean;
}>;
type DatabaseBackedAppFactory = (
  options: DatabaseBackedAppOptions,
) => DatabaseBackedApp;

const createDatabaseBackedApp = Reflect.get(
  session06App,
  "createDatabaseBackedApp",
) as DatabaseBackedAppFactory;

const createOptions = (): DatabaseBackedAppOptions => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-06-"));
  directories.push(directory);

  return {
    databasePath: join(directory, "clinic.sqlite"),
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    isProduction: false,
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
    const auditCount = database
      .prepare("SELECT count(*) AS count FROM audit_logs")
      .get() as Readonly<{ count: number }>;

    return { auditCount: auditCount.count, state: appointment.state };
  } finally {
    database.close();
  }
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("file SQLite maps an absent appointment to the not-found notice", async () => {
  const app = createDatabaseBackedApp(createOptions());
  try {
    const response = await post(
      app,
      "/appointments/99999999-9999-4999-8999-999999999999/start-examination",
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?notice=not-found");
  } finally {
    app.close();
  }
});

test("file SQLite maps a Scheduled appointment to the invalid-state notice", async () => {
  const app = createDatabaseBackedApp(createOptions());
  try {
    const response = await post(
      app,
      `/appointments/${clinicFixture.appointmentId}/start-examination`,
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/?notice=invalid-state");
  } finally {
    app.close();
  }
});

test("SQLite audit failure leaves the started state without an examination audit", async () => {
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

    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(500);
  } finally {
    app.close();
  }

  const persisted = observe(options.databasePath);
  expect(JSON.parse(persisted.state)).toMatchObject({ kind: "InExamination" });
  expect(persisted.auditCount).toBe(1);
});

test("corrupt persisted state rejects the effectful use case as a ZodError", async () => {
  const options = createOptions();
  const seeded = createDatabaseBackedApp(options);
  seeded.close();

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
    const store = createAppointmentStore(database, session06InitialAppointment);
    const effect = startExaminationWithEffects({
      resolver: store,
      stateStore: store.stateStore,
      eventLog: store.eventLog,
    });

    await expect(effect({
      appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
      veterinarianId: VeterinarianId.parse(clinicFixture.veterinarianId),
    })).rejects.toBeInstanceOf(ZodError);
  } finally {
    database.close();
  }
});

test("atomic store rejects the SQLite audit failure and rolls back the state", async () => {
  const options = createOptions();
  const seeded = createDatabaseBackedApp(options);
  seeded.close();

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
    const store = createAppointmentStore(database, session06InitialAppointment);
    const checkedIn = checkIn(
      session06InitialAppointment,
      clinicFixture.checkedInAt,
    );
    store.save(checkedIn);
    const event = Appointment.startExamination({
      eventId: EventId.parse("55555555-5555-4555-8555-555555555555"),
      occurredAt: "2026-08-30T06:30:00.000Z",
    })(checkedIn, VeterinarianId.parse(clinicFixture.veterinarianId));

    await expect(store.atomicStore.store(event)).rejects.toMatchObject({
      kind: "AppointmentPersistenceError",
      operation: "append-audit",
    } satisfies Partial<AppointmentPersistenceError>);
  } finally {
    database.close();
  }

  const persisted = observe(options.databasePath);
  expect(JSON.parse(persisted.state)).toMatchObject({ kind: "CheckedIn" });
  expect(persisted.auditCount).toBe(1);
});
