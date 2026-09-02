import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterEach, describe, expect, test } from "vitest";

import { clinicFixture } from "../../fixtures/clinic.js";
import { EventId } from "../../session-07/src/domain/aggregate/eventId.js";
import {
  snapshotScenarios,
  type SnapshotEffects,
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
const missingAppointmentId = "00000000-0000-4000-8000-000000000099";
const eventId = EventId.parse("77777777-7777-4777-8777-777777777777");
const occurredAt = "2026-08-30T08:00:00.000Z";

const post = (
  app: ReturnType<SnapshotScenario["createApp"]>,
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

const createDatabasePath = (name: string): string => {
  const directory = mkdtempSync(join(tmpdir(), `start-examination-${name}-`));
  directories.push(directory);
  return join(directory, "clinic.sqlite");
};

const closeIfSupported = (app: ReturnType<SnapshotScenario["createApp"]>): void => {
  const close = (app as Readonly<{ close?: unknown }>).close;
  if (typeof close === "function") close.call(app);
};

const scenarioFor = (name: SnapshotScenario["name"]): SnapshotScenario => {
  const scenario = snapshotScenarios.find((candidate) => candidate.name === name);
  if (scenario === undefined) throw new Error(`Snapshot scenario is missing: ${name}`);
  return scenario;
};

const createEffectfulApp = (
  scenario: SnapshotScenario,
  databasePath: string,
  effects: SnapshotEffects,
) => {
  if (scenario.createAppWithEffects === undefined) {
    throw new Error(`Snapshot scenario does not support effect injection: ${scenario.name}`);
  }

  return scenario.createAppWithEffects(databasePath, effects);
};

const installAuditFailureTrigger = (databasePath: string): void => {
  const database = new Database(databasePath);
  try {
    database.exec(`
      CREATE TRIGGER fail_examination_audit
      BEFORE INSERT ON audit_logs
      WHEN NEW.event_name = 'ExaminationStarted'
      BEGIN
        SELECT RAISE(FAIL, 'forced audit failure');
      END;
    `);
  } finally {
    database.close();
  }
};

const captureAuditFailure = async (scenario: SnapshotScenario) => {
  const databasePath = createDatabasePath(scenario.name.replace(" ", "-").toLowerCase());
  const seeded = scenario.createApp(databasePath);
  closeIfSupported(seeded);
  installAuditFailureTrigger(databasePath);

  const app = scenario.createApp(databasePath);
  let auditLogCountBeforeCheckIn = 0;
  let auditLogCountBeforeStart = 0;
  let httpStatus = 0;
  try {
    auditLogCountBeforeCheckIn = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    ).auditLogs.length;
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    auditLogCountBeforeStart = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    ).auditLogs.length;
    expect(auditLogCountBeforeStart).toBe(auditLogCountBeforeCheckIn);
    httpStatus = (await post(app, `${appointmentUrl}/start-examination`)).status;
  } finally {
    closeIfSupported(app);
  }

  const observation = observeAppointment(databasePath, clinicFixture.appointmentId);
  return {
    appendedEvents: observation.auditLogs.slice(auditLogCountBeforeStart).length,
    appointmentKind: scenario.normalizeState(observation.state),
    httpStatus,
  };
};

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.each(["Session 06", "Session 07"] as const)("%s", (name) => {
  test("keeps missing and invalid-state notices distinct from infrastructure failures", async () => {
    const scenario = scenarioFor(name);
    const databasePath = createDatabasePath(`${name}-business-errors`.replace(" ", "-").toLowerCase());
    const missingApp = scenario.createApp(databasePath);
    const beforeMissing = observeAppointment(databasePath, clinicFixture.appointmentId);
    let missingResponse!: Response;
    try {
      missingResponse = await post(
        missingApp,
        `/appointments/${missingAppointmentId}/start-examination`,
      );
    } finally {
      closeIfSupported(missingApp);
    }
    const afterMissing = observeAppointment(databasePath, clinicFixture.appointmentId);

    const invalidStateApp = scenario.createApp(databasePath);
    const beforeInvalidState = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    );
    let invalidStateResponse!: Response;
    try {
      invalidStateResponse = await post(
        invalidStateApp,
        `${appointmentUrl}/start-examination`,
      );
    } finally {
      closeIfSupported(invalidStateApp);
    }
    const afterInvalidState = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    );

    expect(missingResponse.status).toBe(303);
    expect(missingResponse.status).not.toBe(500);
    expect(missingResponse.headers.get("location")).toBe("/?notice=not-found");
    expect(afterMissing).toEqual(beforeMissing);
    expect(invalidStateResponse.status).toBe(303);
    expect(invalidStateResponse.status).not.toBe(500);
    expect(invalidStateResponse.headers.get("location")).toBe(
      "/?notice=invalid-state",
    );
    expect(afterInvalidState).toEqual(beforeInvalidState);
  });
});

test("Session 07 persists its injected clock and event ID in the examination audit", async () => {
  const scenario = scenarioFor("Session 07");
  const databasePath = createDatabasePath("session-07-injected-effects");
  const app = createEffectfulApp(scenario, databasePath, {
    clock: { now: () => occurredAt },
    eventIdGenerator: { generate: () => eventId },
  });
  let auditLogCountBeforeCheckIn = 0;
  let auditLogCountBeforeStart = 0;

  try {
    auditLogCountBeforeCheckIn = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    ).auditLogs.length;
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    auditLogCountBeforeStart = observeAppointment(
      databasePath,
      clinicFixture.appointmentId,
    ).auditLogs.length;
    expect(auditLogCountBeforeStart).toBe(auditLogCountBeforeCheckIn);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
  } finally {
    closeIfSupported(app);
  }

  const examinationStartedAudits = observeAppointment(
    databasePath,
    clinicFixture.appointmentId,
  ).auditLogs.slice(auditLogCountBeforeStart);
  expect(examinationStartedAudits).toEqual([
    {
      appointmentId: clinicFixture.appointmentId,
      eventId,
      eventName: "ExaminationStarted",
      occurredAt,
      payload: {
        appointmentId: clinicFixture.appointmentId,
        examinationStartedAt: occurredAt,
        veterinarianId: clinicFixture.veterinarianId,
      },
    },
  ]);
});

test("Session 06 leaves the state update while Session 07 rolls it back after the same audit failure", async () => {
  const session06 = await captureAuditFailure(scenarioFor("Session 06"));
  const session07 = await captureAuditFailure(scenarioFor("Session 07"));

  expect(session06).toEqual({
    httpStatus: 500,
    appointmentKind: "InExamination",
    appendedEvents: 0,
  });
  expect(session07).toEqual({
    httpStatus: 500,
    appointmentKind: "CheckedIn",
    appendedEvents: 0,
  });
});
