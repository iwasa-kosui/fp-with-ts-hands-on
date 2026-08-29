import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createAppointmentRepository } from "./adaptor/secondary/sqlite/appointmentRepository.js";
import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "./adaptor/secondary/sqlite/db.js";
import { initialAppointment, registerClinicRoutes } from "./web/routes.js";

type DatabaseBackedAppOptions = Readonly<{
  databasePath: string;
  migrationsFolder: string;
  isProduction: boolean;
}>;

export type DatabaseBackedApp = Hono &
  Readonly<{
    close: () => void;
  }>;

const createApp = (database: SqliteDatabase, isProduction = false): Hono => {
  const repository = createAppointmentRepository(database);
  repository.seedIfEmpty(initialAppointment);
  const app = new Hono();

  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(isProduction) }),
  );
  registerClinicRoutes(app, repository);
  app.onError((_error, context) => context.text("Internal Server Error", 500));

  return app;
};

export const createDatabaseBackedApp = ({
  databasePath,
  migrationsFolder,
  isProduction,
}: DatabaseBackedAppOptions): DatabaseBackedApp => {
  const database = createSqliteDatabase(databasePath);

  try {
    migrateDatabase(database, migrationsFolder);
    return Object.assign(createApp(database, isProduction), {
      close: () => database.close(),
    });
  } catch (error) {
    database.close();
    throw error;
  }
};
