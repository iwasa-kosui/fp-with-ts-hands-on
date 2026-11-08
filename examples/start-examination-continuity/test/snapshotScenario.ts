import { fileURLToPath } from "node:url";

import { createDatabaseBackedApp as createSession00App } from "../../session-00/src/app.js";
import { createDatabaseBackedApp as createSession05App } from "../../session-05/src/app.js";
import { createDatabaseBackedApp as createSession01App } from "../../session-01/src/app.js";
import { createDatabaseBackedApp as createSession02App } from "../../session-02/src/app.js";
import { createDatabaseBackedApp as createSession02SolutionApp } from "../../session-02-solution/src/app.js";
import { createDatabaseBackedApp as createSession03App } from "../../session-03/src/app.js";
import { createDatabaseBackedApp as createSession04App } from "../../session-04/src/app.js";
import { createDatabaseBackedApp as createSession06App } from "../../session-06/src/app.js";
import { createDatabaseBackedApp as createSession06SolutionApp } from "../../session-06-solution/src/app.js";
import type { Clock } from "../../session-06-solution/src/domain/aggregate/clock.js";
import type { EventIdGenerator } from "../../session-06-solution/src/domain/aggregate/eventIdGenerator.js";

type SnapshotState =
  | "Scheduled"
  | "CheckedIn"
  | "InExamination"
  | "AwaitingPayment"
  | "Paid"
  | "Canceled";

export type SnapshotScenario = Readonly<{
  name:
    | "session-00"
    | "session-05"
    | "session-01"
    | "session-02"
    | "session-02-solution"
    | "session-03"
    | "session-04"
    | "session-06"
    | "session-06-solution";
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

const migrationFolderFor = (folder: SnapshotScenario["name"]): string =>
  fileURLToPath(new URL(`../../${folder}/drizzle`, import.meta.url));

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
  createScenario("session-00", createSession00App, migrationFolderFor("session-00"), stateFromStatus),
  createScenario("session-05", createSession05App, migrationFolderFor("session-05"), stateFromStatus),
  createScenario("session-01", createSession01App, migrationFolderFor("session-01"), stateFromKind),
  createScenario("session-02", createSession02App, migrationFolderFor("session-02"), stateFromKind),
  createScenario(
    "session-02-solution",
    createSession02SolutionApp,
    migrationFolderFor("session-02-solution"),
    stateFromKind,
  ),
  createScenario("session-03", createSession03App, migrationFolderFor("session-03"), stateFromKind),
  createScenario("session-04", createSession04App, migrationFolderFor("session-04"), stateFromKind),
  createScenario("session-06", createSession06App, migrationFolderFor("session-06"), stateFromKind),
  createScenario(
    "session-06-solution",
    createSession06SolutionApp,
    migrationFolderFor("session-06-solution"),
    stateFromKind,
    createSession06SolutionApp,
  ),
];
