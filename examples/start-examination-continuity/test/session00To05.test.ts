import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

const normalizeExaminationStartedEventName = (eventName: string): string =>
  eventName === "examination.started" ? "ExaminationStarted" : eventName;

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.each(snapshotScenarios)("$name", (scenario) => {
  test("persists the common check-in and examination-start outcome", async () => {
    const databasePath = createDatabasePath(scenario.name.replace(" ", "-").toLowerCase());
    const app = scenario.createApp(databasePath);
    let auditLogCountAfterCheckIn = 0;

    try {
      expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
      auditLogCountAfterCheckIn = observeAppointment(
        databasePath,
        clinicFixture.appointmentId,
      ).auditLogs.length;
      expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
    } finally {
      closeIfSupported(app);
    }

    const observation = observeAppointment(databasePath, clinicFixture.appointmentId);
    const examinationStartedAudits = observation.auditLogs.slice(auditLogCountAfterCheckIn);
    expect(scenario.normalizeState(observation.state)).toBe("InExamination");
    expect(examinationStartedAudits).toHaveLength(1);
    expect(examinationStartedAudits.at(-1)).toMatchObject({
      appointmentId: clinicFixture.appointmentId,
    });
    expect(
      normalizeExaminationStartedEventName(examinationStartedAudits.at(-1)?.eventName ?? ""),
    ).toBe("ExaminationStarted");
  });
});

test("Session 00 accepts a restart after payment and persists the restarted state", async () => {
  const scenario = scenarioFor("Session 00");
  const databasePath = createDatabasePath("session-00-paid-restart");
  const app = scenario.createApp(databasePath);
  let auditLogCountBeforeRestart = 0;

  try {
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/exam-results`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/payment`)).status).toBe(303);
    const beforeRestart = observeAppointment(databasePath, clinicFixture.appointmentId);
    expect(scenario.normalizeState(beforeRestart.state)).toBe(
      "Paid",
    );
    auditLogCountBeforeRestart = beforeRestart.auditLogs.length;
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
  } finally {
    closeIfSupported(app);
  }

  const observation = observeAppointment(databasePath, clinicFixture.appointmentId);
  expect(scenario.normalizeState(observation.state)).toBe("InExamination");
  expect(observation.auditLogs).toHaveLength(auditLogCountBeforeRestart + 1);
  expect(observation.auditLogs.at(-1)).toMatchObject({
    appointmentId: clinicFixture.appointmentId,
  });
  expect(normalizeExaminationStartedEventName(observation.auditLogs.at(-1)?.eventName ?? "")).toBe(
    "ExaminationStarted",
  );
});

test("Session 03 rejects examination start from Scheduled without changing SQLite", async () => {
  const scenario = scenarioFor("Session 03");
  const databasePath = createDatabasePath("session-03-invalid-state");
  const app = scenario.createApp(databasePath);
  const before = observeAppointment(databasePath, clinicFixture.appointmentId);

  try {
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(500);
  } finally {
    closeIfSupported(app);
  }

  const after = observeAppointment(databasePath, clinicFixture.appointmentId);
  expect(scenario.normalizeState(after.state)).toBe("Scheduled");
  expect(after).toEqual(before);
});

test("Session 05 rejects invalid appointment and veterinarian identifiers without changing SQLite", async () => {
  const scenario = scenarioFor("Session 05");
  const databasePath = createDatabasePath("session-05-invalid-identifiers");
  const seeded = scenario.createApp(databasePath);
  closeIfSupported(seeded);

  const invalidAppointmentApp = scenario.createApp(databasePath);
  const beforeInvalidAppointment = observeAppointment(databasePath, clinicFixture.appointmentId);
  try {
    expect((await post(invalidAppointmentApp, "/appointments/not-a-uuid/start-examination")).status).toBe(500);
  } finally {
    closeIfSupported(invalidAppointmentApp);
  }
  expect(observeAppointment(databasePath, clinicFixture.appointmentId)).toEqual(beforeInvalidAppointment);

  const originalVeterinarianId = clinicFixture.veterinarianId;
  const invalidVeterinarianApp = scenario.createApp(databasePath);
  const beforeInvalidVeterinarian = observeAppointment(databasePath, clinicFixture.appointmentId);
  try {
    expect(Reflect.set(clinicFixture, "veterinarianId", "not-a-uuid")).toBe(true);
    expect((await post(invalidVeterinarianApp, `${appointmentUrl}/start-examination`)).status).toBe(500);
  } finally {
    Reflect.set(clinicFixture, "veterinarianId", originalVeterinarianId);
    closeIfSupported(invalidVeterinarianApp);
  }
  expect(observeAppointment(databasePath, clinicFixture.appointmentId)).toEqual(beforeInvalidVeterinarian);
});

test("Session 05 stores an examination audit payload without owner contact", async () => {
  const scenario = scenarioFor("Session 05");
  const databasePath = createDatabasePath("session-05-pii");
  const app = scenario.createApp(databasePath);

  try {
    expect((await post(app, `${appointmentUrl}/check-in`)).status).toBe(303);
    expect((await post(app, `${appointmentUrl}/start-examination`)).status).toBe(303);
  } finally {
    closeIfSupported(app);
  }

  const observation = observeAppointment(databasePath, clinicFixture.appointmentId);
  const audit = observation.auditLogs.at(-1);
  const serializedPayload = JSON.stringify(audit?.payload);

  expect(scenario.normalizeState(observation.state)).toBe("InExamination");
  expect(audit).toMatchObject({
    appointmentId: clinicFixture.appointmentId,
    eventName: "ExaminationStarted",
  });
  expect(typeof serializedPayload).toBe("string");
  if (serializedPayload === undefined) throw new Error("Missing examination audit payload");
  expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerName);
  expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerEmail);
  expect(serializedPayload).not.toContain(clinicFixture.ownerContact.ownerPhone);
});
