import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";
import { afterEach, expect, test } from "vitest";

import { clinicFixture } from "../../../fixtures/clinic.js";
import { createDatabaseBackedApp } from "../../src/app.js";

const directories: string[] = [];

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const post = (app: ReturnType<typeof createDatabaseBackedApp>, path: string, body?: unknown) =>
  body === undefined
    ? app.request(path, { method: "POST", headers: inertiaHeaders })
    : app.request(path, {
        method: "POST",
        headers: { ...inertiaHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("file SQLite reopens the Session 03 examination state and leaking audit context", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-03-"));
  directories.push(directory);
  const options = {
    databasePath: join(directory, "clinic.sqlite"),
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    isProduction: false,
  } as const;
  const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
  const first = createDatabaseBackedApp(options);

  try {
    expect((await post(first, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect((await post(first, `${appointmentUrl}/start-examination`)).status).toBe(
      303,
    );
  } finally {
    first.close();
  }

  const database = new Database(options.databasePath, { readonly: true });
  try {
    const appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    const audit = database
      .prepare("SELECT event_name, payload FROM audit_logs ORDER BY rowid DESC LIMIT 1")
      .get() as Readonly<{ event_name: string; payload: string }>;

    expect(JSON.parse(appointment.state)).toMatchObject({ kind: "InExamination" });
    expect(audit.event_name).toBe("ExaminationStarted");
    expect(JSON.parse(audit.payload)).toMatchObject({
      appointment: { kind: "InExamination" },
      ownerContact: clinicFixture.ownerContact,
    });
  } finally {
    database.close();
  }

  const second = createDatabaseBackedApp(options);
  try {
    const response = await second.request("/", { headers: inertiaHeaders });
    expect(await response.json()).toMatchObject({
      props: { appointment: { kind: "InExamination" } },
    });
  } finally {
    second.close();
  }
});

test("Session 03 does not add an audit event when a Paid appointment starts examination", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-03-paid-"));
  directories.push(directory);
  const options = {
    databasePath: join(directory, "clinic.sqlite"),
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
    isProduction: false,
  } as const;
  const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;
  const app = createDatabaseBackedApp(options);

  try {
    await post(app, `${appointmentUrl}/check-in`);
    await post(app, `${appointmentUrl}/start-examination`);
    await post(app, `${appointmentUrl}/exam-results`, {
      examId: clinicFixture.examId,
    });
    await post(app, `${appointmentUrl}/payment`);

    const database = new Database(options.databasePath, { readonly: true });
    const before = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    const beforeAuditCount = database
      .prepare("SELECT count(*) AS count FROM audit_logs")
      .get() as Readonly<{ count: number }>;
    database.close();

    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(500);

    const afterDatabase = new Database(options.databasePath, { readonly: true });
    try {
      const after = afterDatabase
        .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
        .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
      const afterAuditCount = afterDatabase
        .prepare("SELECT count(*) AS count FROM audit_logs")
        .get() as Readonly<{ count: number }>;

      expect(JSON.parse(after.state)).toEqual(JSON.parse(before.state));
      expect(afterAuditCount.count).toBe(beforeAuditCount.count);
    } finally {
      afterDatabase.close();
    }
  } finally {
    app.close();
  }
});
