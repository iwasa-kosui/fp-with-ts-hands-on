import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createAppointmentRepository } from "./adaptor/secondary/sqlite/appointmentRepository.js";
import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "./adaptor/secondary/sqlite/db.js";
import { registerClinicRoutes, session05InitialAppointment } from "./web/routes.js";

type DatabaseBackedAppOptions = Readonly<{
  databasePath: string;
  migrationsFolder: string;
  isProduction: boolean;
}>;

export type DatabaseBackedApp = Hono & Readonly<{ close: () => void }>;

const createHonoApp = (database: SqliteDatabase, isProduction: boolean): Hono => {
  const app = new Hono();
  const repository = createAppointmentRepository(database);
  repository.seedIfEmpty(session05InitialAppointment);
  const store = {
    find: repository.find,
    resolveById: repository.resolveById,
    reset: () => {
      repository.reset(session05InitialAppointment);
      return session05InitialAppointment;
    },
    save: repository.save,
  };

  app.use("*", inertia({ version: "1", rootView: createClinicRootView(isProduction) }));
  registerClinicRoutes(app, store);
  app.onError((_error, context) => context.text("Internal Server Error", 500));
  return app;
};

const createDatabaseBackedAppFromDatabase = (
  database: SqliteDatabase,
  isProduction: boolean,
): DatabaseBackedApp =>
  Object.assign(createHonoApp(database, isProduction), {
    close: () => database.close(),
  });

export const createApp = (isProduction = false): DatabaseBackedApp => {
  const database = createSqliteDatabase(":memory:");

  try {
    migrateDatabase(database);
    return createDatabaseBackedAppFromDatabase(database, isProduction);
  } catch (error) {
    database.close();
    throw error;
  }
};

export const createDatabaseBackedApp = ({
  databasePath,
  migrationsFolder,
  isProduction,
}: DatabaseBackedAppOptions): DatabaseBackedApp => {
  const database = createSqliteDatabase(databasePath);

  try {
    migrateDatabase(database, migrationsFolder);
    return createDatabaseBackedAppFromDatabase(database, isProduction);
  } catch (error) {
    database.close();
    throw error;
  }
};
