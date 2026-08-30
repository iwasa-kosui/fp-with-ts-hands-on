import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

import { clinicFixture } from "../../fixtures/clinic.js";
import {
  snapshotScenarios,
  type SnapshotScenario,
} from "./snapshotScenario.js";
import { observeAppointment } from "./sqliteObservation.js";

const directories: string[] = [];

const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const appointmentUrl = `/appointments/${clinicFixture.appointmentId}`;

const post = (
  app: ReturnType<SnapshotScenario["createApp"]>,
  path: string,
) => app.request(path, { method: "POST", headers: inertiaHeaders });

const createDatabasePath = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), `reset-atomicity-${name}-`));
  directories.push(directory);
  return join(directory, "clinic.sqlite");
};

const closeIfSupported = (app: ReturnType<SnapshotScenario["createApp"]>): void => {
  const close = (app as Readonly<{ close?: unknown }>).close;
  if (typeof close === "function") close.call(app);
};

const installSeedAuditFailureTrigger = (databasePath: string): void => {
  const database = new Database(databasePath);
  try {
    database.exec(`
      CREATE TRIGGER fail_appointment_seed_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.event_name = 'AppointmentSeeded'
      BEGIN
        SELECT RAISE(FAIL, 'forced seed audit failure');
      END;
    `);
  } finally {
    database.close();
  }
};

const resetScenarioNames = [
  "Session 02",
  "Session 03",
  "Session 04",
  "Session 05",
  "Session 06",
  "Session 07",
] as const;

const resetScenarios = resetScenarioNames.map((name) => {
  const scenario = snapshotScenarios.find((candidate) => candidate.name === name);
  if (scenario === undefined) throw new Error(`Snapshot scenario is missing: ${name}`);
  return scenario;
});

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.each(resetScenarios)("$name reset", (scenario) => {
  test("preserves the previous appointment and audits when AppointmentSeeded fails", async () => {
    const databasePath = createDatabasePath(
      scenario.name.replace(" ", "-").toLowerCase(),
    );
    const app = scenario.createApp(databasePath);

    try {
      expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
      const before = observeAppointment(databasePath, clinicFixture.appointmentId);
      expect(scenario.normalizeState(before.state)).toBe("CheckedIn");
      expect(before.auditLogs.length).toBeGreaterThan(0);

      installSeedAuditFailureTrigger(databasePath);

      expect((await post(app, "/demo/reset")).status).toBe(500);
      expect(observeAppointment(databasePath, clinicFixture.appointmentId)).toEqual(before);
    } finally {
      closeIfSupported(app);
    }
  });
});
