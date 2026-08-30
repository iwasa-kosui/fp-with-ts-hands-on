import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createExaminationStartedStore } from "./adaptor/secondary/sqlite/examinationStartedStore.js";
import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "./adaptor/secondary/sqlite/db.js";
import type { Clock } from "./domain/aggregate/clock.js";
import { EventId } from "./domain/aggregate/eventId.js";
import type { EventIdGenerator } from "./domain/aggregate/eventIdGenerator.js";
import type { EventContextDependencies } from "./useCase/dependencies.js";
import {
  registerClinicRoutes,
  session07InitialAppointment,
} from "./web/routes.js";

export type CreateAppOptions = Readonly<{
  clock?: Clock;
  eventIdGenerator?: EventIdGenerator;
  isProduction?: boolean;
}>;

export type DatabaseBackedAppOptions = Readonly<{
  clock?: Clock;
  databasePath: string;
  eventIdGenerator?: EventIdGenerator;
  isProduction: boolean;
  migrationsFolder: string;
}>;

export type DatabaseBackedApp = Hono & Readonly<{ close: () => void }>;

const defaultEffects: EventContextDependencies = {
  clock: { now: () => "2026-08-30T06:30:00.000Z" },
  eventIdGenerator: {
    generate: () => EventId.parse("55555555-5555-4555-8555-555555555555"),
  },
};

const createHonoApp = (
  database: SqliteDatabase,
  effects: EventContextDependencies,
  isProduction: boolean,
): Hono => {
  const app = new Hono();
  const store = createExaminationStartedStore(
    database,
    session07InitialAppointment,
  );
  store.seedIfEmpty();
  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(isProduction) }),
  );
  registerClinicRoutes(app, store, effects);
  app.onError((_error, context) => context.text("Internal Server Error", 500));
  return app;
};

const createDatabaseBackedAppFromDatabase = (
  database: SqliteDatabase,
  effects: EventContextDependencies,
  isProduction: boolean,
): DatabaseBackedApp =>
  Object.assign(createHonoApp(database, effects, isProduction), {
    close: () => database.close(),
  });

const mergeEffects = (
  clock: Clock | undefined,
  eventIdGenerator: EventIdGenerator | undefined,
): EventContextDependencies => ({
  clock: clock ?? defaultEffects.clock,
  eventIdGenerator: eventIdGenerator ?? defaultEffects.eventIdGenerator,
});

export const createApp = (
  options: CreateAppOptions = {},
): DatabaseBackedApp => {
  const database = createSqliteDatabase(":memory:");

  try {
    migrateDatabase(database);
    return createDatabaseBackedAppFromDatabase(
      database,
      mergeEffects(options.clock, options.eventIdGenerator),
      options.isProduction === true,
    );
  } catch (error) {
    database.close();
    throw error;
  }
};

export const createDatabaseBackedApp = ({
  clock,
  databasePath,
  eventIdGenerator,
  isProduction,
  migrationsFolder,
}: DatabaseBackedAppOptions): DatabaseBackedApp => {
  const database = createSqliteDatabase(databasePath);

  try {
    migrateDatabase(database, migrationsFolder);
    return createDatabaseBackedAppFromDatabase(
      database,
      mergeEffects(clock, eventIdGenerator),
      isProduction,
    );
  } catch (error) {
    database.close();
    throw error;
  }
};
