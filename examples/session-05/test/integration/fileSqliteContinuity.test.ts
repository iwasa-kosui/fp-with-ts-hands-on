import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, expect, test } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createDatabaseBackedApp } from "../../src/app.js";
import {
  AppointmentPersistenceError,
} from "../../src/adaptor/secondary/sqlite/appointmentPersistenceError.js";
import {
  createAppointmentRepository,
} from "../../src/adaptor/secondary/sqlite/appointmentRepository.js";
import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  AppointmentId,
  VeterinarianId,
  checkIn,
  startExamination,
} from "../../src/domain/appointment/index.js";
import { session05InitialAppointment } from "../../src/web/routes.js";

const directories: string[] = [];

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const createOptions = () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-05-"));
  directories.push(directory);

  return {
    databasePath: join(directory, "clinic.sqlite"),
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    isProduction: false,
  } as const;
};

const post = (
  app: ReturnType<typeof createDatabaseBackedApp>,
  path: string,
) => app.request(path, { method: "POST", headers: inertiaHeaders });

const observe = (databasePath: string) => {
  const database = new Database(databasePath, { readonly: true });
  try {
    const appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    const auditCount = database
      .prepare("SELECT count(*) AS count FROM audit_logs")
      .get() as Readonly<{ count: number }>;

    return { state: appointment.state, auditCount: auditCount.count };
  } finally {
    database.close();
  }
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("file SQLite stores an examination audit payload without owner contact", async () => {
  const options = createOptions();
  const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
  const app = createDatabaseBackedApp(options);

  try {
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(
      303,
    );
  } finally {
    app.close();
  }

  const database = new Database(options.databasePath, { readonly: true });
  try {
    const appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    const audit = database
      .prepare(
        "SELECT event_name, payload FROM audit_logs ORDER BY rowid DESC LIMIT 1",
      )
      .get() as Readonly<{ event_name: string; payload: string }>;
    const payload = JSON.parse(audit.payload);
    const serializedPayload = JSON.stringify(payload);

    expect(JSON.parse(appointment.state)).toMatchObject({ kind: "InExamination" });
    expect(audit.event_name).toBe("ExaminationStarted");
    expect(payload).toEqual({
      appointmentId: clinicFixture.appointmentId,
      veterinarianId: clinicFixture.veterinarianId,
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
    });
    expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerName);
    expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerEmail);
    expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerPhone);
  } finally {
    database.close();
  }
});

test("invalid start-examination IDs return 500 without changing file SQLite", async () => {
  const options = createOptions();
  const first = createDatabaseBackedApp(options);
  first.close();
  const before = observe(options.databasePath);

  const invalidAppointmentApp = createDatabaseBackedApp(options);
  try {
    const response = await post(
      invalidAppointmentApp,
      "/appointments/not-a-uuid/start-examination",
    );
    expect(response.status).toBe(500);
  } finally {
    invalidAppointmentApp.close();
  }
  expect(observe(options.databasePath)).toEqual(before);

  const originalVeterinarianId = clinicFixture.veterinarianId;
  const invalidVeterinarianApp = createDatabaseBackedApp(options);
  try {
    expect(Reflect.set(clinicFixture, "veterinarianId", "not-a-uuid")).toBe(true);
    const response = await post(
      invalidVeterinarianApp,
      `/appointments/${clinicFixture.appointmentId}/start-examination`,
    );
    expect(response.status).toBe(500);
  } finally {
    Reflect.set(clinicFixture, "veterinarianId", originalVeterinarianId);
    invalidVeterinarianApp.close();
  }
  expect(observe(options.databasePath)).toEqual(before);
});

test("SQLite audit failures preserve the saved state and expose a PII-free persistence error", () => {
  const options = createOptions();
  const migrationDatabase = createSqliteDatabase(options.databasePath);
  try {
    migrateDatabase(migrationDatabase, options.migrationsFolder);
  } finally {
    migrationDatabase.close();
  }

  const triggerDatabase = new Database(options.databasePath);
  try {
    triggerDatabase.exec(`
      CREATE TRIGGER fail_examination_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.event_name = 'ExaminationStarted'
      BEGIN
        SELECT RAISE(FAIL, 'Owner A owner@example.test 090-0000-0000');
      END;
    `);
  } finally {
    triggerDatabase.close();
  }

  const database = createSqliteDatabase(options.databasePath);
  try {
    const repository = createAppointmentRepository(database);
    repository.seedIfEmpty(session05InitialAppointment);
    const checkedIn = checkIn(
      session05InitialAppointment,
      clinicFixture.checkedInAt,
    );
    const next = startExamination(
      checkedIn,
      VeterinarianId.parse(clinicFixture.veterinarianId),
      "2026-08-30T06:30:00.000Z",
    );

    let thrown: unknown;
    try {
      repository.save(next);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppointmentPersistenceError);
    expect(thrown).toMatchObject({
      operation: "append-audit",
      message: "Appointment persistence failed: append-audit",
    });
    expect((thrown as Error).message).not.toContain(
      clinicFixture.ownerContact.ownerName,
    );
    expect((thrown as Error).message).not.toContain(
      clinicFixture.ownerContact.ownerEmail,
    );
    expect((thrown as Error).message).not.toContain(
      clinicFixture.ownerContact.ownerPhone,
    );
  } finally {
    database.close();
  }

  const persisted = observe(options.databasePath);
  expect(JSON.parse(persisted.state)).toMatchObject({
    appointmentId: AppointmentId.parse(clinicFixture.appointmentId),
    kind: "InExamination",
  });
  expect(persisted.auditCount).toBe(1);
});
