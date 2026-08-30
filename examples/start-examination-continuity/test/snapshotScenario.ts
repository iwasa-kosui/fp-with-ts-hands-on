import { fileURLToPath } from "node:url";

import { createDatabaseBackedApp as createSession00App } from "../../session-00/src/app.js";
import { createDatabaseBackedApp as createSession01App } from "../../session-01/src/app.js";
import { createDatabaseBackedApp as createSession02App } from "../../session-02/src/app.js";
import { createDatabaseBackedApp as createSession03App } from "../../session-03/src/app.js";
import { createDatabaseBackedApp as createSession04App } from "../../session-04/src/app.js";
import { createDatabaseBackedApp as createSession05App } from "../../session-05/src/app.js";
import { createDatabaseBackedApp as createSession06App } from "../../session-06/src/app.js";
import { createDatabaseBackedApp as createSession07App } from "../../session-07/src/app.js";
import type { Clock } from "../../session-07/src/domain/aggregate/clock.js";
import type { EventIdGenerator } from "../../session-07/src/domain/aggregate/eventIdGenerator.js";

type SnapshotState =
  | "Scheduled"
  | "CheckedIn"
  | "InExamination"
  | "AwaitingPayment"
  | "Paid"
  | "Canceled";

export type SnapshotScenario = Readonly<{
  name:
    | "Session 00"
    | "Session 01"
    | "Session 02"
    | "Session 03"
    | "Session 04"
    | "Session 05"
    | "Session 06"
    | "Session 07";
  createApp: (databasePath: string) => SnapshotApp;
  createAppWithEffects?: (
    databasePath: string,
    effects: SnapshotEffects,
  ) => SnapshotApp;
  normalizeState: (state: unknown) => SnapshotState;
}>;

type SnapshotApp = Readonly<{
  request: (path: string, init?: RequestInit) => Promise<Response>;
}>;

export type SnapshotEffects = Readonly<{
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;

type RuntimeApp = Readonly<{
  request: (path: string, init?: RequestInit) => Response | Promise<Response>;
  close?: () => void;
}>;

type DatabaseBackedAppFactory = (options: Readonly<{
  databasePath: string;
  migrationsFolder: string;
  isProduction: boolean;
}>) => RuntimeApp;

type EffectfulDatabaseBackedAppFactory = (options: Readonly<{
  clock: Clock;
  databasePath: string;
  eventIdGenerator: EventIdGenerator;
  isProduction: boolean;
  migrationsFolder: string;
}>) => RuntimeApp;

const snapshotStates = [
  "Scheduled",
  "CheckedIn",
  "InExamination",
  "AwaitingPayment",
  "Paid",
  "Canceled",
] as const;

const stateFromKind = (state: unknown): SnapshotState => {
  if (typeof state !== "object" || state === null) {
    throw new Error("Persisted appointment state must be an object");
  }

  const kind = (state as Readonly<{ kind?: unknown }>).kind;
  if (typeof kind !== "string" || !snapshotStates.includes(kind as SnapshotState)) {
    throw new Error("Persisted appointment state must contain a supported kind");
  }

  return kind as SnapshotState;
};

const stateFromStatus = (state: unknown): SnapshotState => {
  if (typeof state !== "object" || state === null) {
    throw new Error("Persisted appointment state must be an object");
  }

  const status = (state as Readonly<{ status?: unknown }>).status;
  const statesByStatus: Readonly<Record<string, SnapshotState>> = {
    scheduled: "Scheduled",
    "checked-in": "CheckedIn",
    "in-examination": "InExamination",
    "awaiting-payment": "AwaitingPayment",
    paid: "Paid",
    canceled: "Canceled",
  };
  if (typeof status !== "string" || statesByStatus[status] === undefined) {
    throw new Error("Persisted appointment state must contain a supported status");
  }

  return statesByStatus[status];
};

const migrationFolderFor = (session: string): string =>
  fileURLToPath(new URL(`../../session-${session}/drizzle`, import.meta.url));

const toSnapshotApp = (runtimeApp: RuntimeApp): SnapshotApp => {
  const app = {
    request: async (path: string, init?: RequestInit): Promise<Response> =>
      await runtimeApp.request(path, init),
  };

  return runtimeApp.close === undefined
    ? app
    : Object.assign(app, { close: runtimeApp.close });
};

const createScenario = (
  name: SnapshotScenario["name"],
  createDatabaseBackedApp: DatabaseBackedAppFactory,
  migrationsFolder: string,
  normalizeState: SnapshotScenario["normalizeState"],
  createEffectfulDatabaseBackedApp?: EffectfulDatabaseBackedAppFactory,
): SnapshotScenario => {
  const effectsAdapter = createEffectfulDatabaseBackedApp === undefined
    ? {}
    : {
      createAppWithEffects: (databasePath: string, effects: SnapshotEffects) =>
        toSnapshotApp(createEffectfulDatabaseBackedApp({
          ...effects,
          databasePath,
          migrationsFolder,
          isProduction: false,
        })),
    };

  return {
    name,
    createApp: (databasePath) =>
      toSnapshotApp(createDatabaseBackedApp({
        databasePath,
        migrationsFolder,
        isProduction: false,
      })),
    ...effectsAdapter,
    normalizeState,
  };
};

export const snapshotScenarios: readonly SnapshotScenario[] = [
  createScenario("Session 00", createSession00App, migrationFolderFor("00"), stateFromStatus),
  createScenario("Session 01", createSession01App, migrationFolderFor("01"), stateFromStatus),
  createScenario("Session 02", createSession02App, migrationFolderFor("02"), stateFromKind),
  createScenario("Session 03", createSession03App, migrationFolderFor("03"), stateFromKind),
  createScenario("Session 04", createSession04App, migrationFolderFor("04"), stateFromKind),
  createScenario("Session 05", createSession05App, migrationFolderFor("05"), stateFromKind),
  createScenario("Session 06", createSession06App, migrationFolderFor("06"), stateFromKind),
  createScenario(
    "Session 07",
    createSession07App,
    migrationFolderFor("07"),
    stateFromKind,
    createSession07App,
  ),
];
