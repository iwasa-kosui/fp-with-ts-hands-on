import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

const post = (app: ReturnType<typeof createDatabaseBackedApp>, path: string) =>
  app.request(path, { method: "POST", headers: inertiaHeaders });

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("ファイルSQLiteは診察開始の状態と監査を再起動後も保持する", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-session-01-"));
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
    expect(
      (await post(first, `${appointmentUrl}/start-examination`)).status,
    ).toBe(303);
  } finally {
    first.close();
  }

  const database = new Database(options.databasePath, { readonly: true });
  let appointment: Readonly<{ state: string }>;
  let audit: Readonly<{
    event_name: string;
    payload: string;
  }>;
  try {
    appointment = database
      .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
      .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
    audit = database
      .prepare(
        "SELECT event_name, payload FROM audit_logs WHERE event_name = ? ORDER BY rowid DESC LIMIT 1",
      )
      .get("examination.started") as Readonly<{
      event_name: string;
      payload: string;
    }>;
  } finally {
    database.close();
  }

  expect(JSON.parse(appointment.state).status).toBe("in-examination");
  expect(audit.event_name).toBe("examination.started");
  expect(JSON.parse(audit.payload)).toMatchObject({
    appointmentId: clinicFixture.appointmentId,
    veterinarianId: clinicFixture.veterinarianId,
  });

  const second = createDatabaseBackedApp(options);
  let restartedAppointment: Readonly<{ state: string }>;
  let restartedAudit: Readonly<{ event_name: string }>;
  try {
    const restartedDatabase = new Database(options.databasePath, {
      readonly: true,
    });
    try {
      restartedAppointment = restartedDatabase
        .prepare("SELECT state FROM appointments WHERE appointment_id = ?")
        .get(clinicFixture.appointmentId) as Readonly<{ state: string }>;
      restartedAudit = restartedDatabase
        .prepare(
          "SELECT event_name FROM audit_logs WHERE event_name = ? ORDER BY rowid DESC LIMIT 1",
        )
        .get("examination.started") as Readonly<{ event_name: string }>;
    } finally {
      restartedDatabase.close();
    }
  } finally {
    second.close();
  }

  expect(second).toBeDefined();
  expect(JSON.parse(restartedAppointment.state).status).toBe("in-examination");
  expect(restartedAudit.event_name).toBe("examination.started");

  const appSource = readFileSync(
    new URL("../../src/app.ts", import.meta.url),
    "utf8",
  );
  expect(appSource).not.toContain("session-00");
});
