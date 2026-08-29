import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createAppointmentStore } from "./adaptor/secondary/sqlite/appointmentStore.js";
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

export const createApp = (
  database: SqliteDatabase,
  isProduction = false,
): Hono => {
  const store = createAppointmentStore(database);
  store.seedIfEmpty(initialAppointment);
  const app = new Hono();

  app.use(
    "*",
    inertia({
      version: "1",
      rootView: createClinicRootView(isProduction),
    }),
  );
  registerClinicRoutes(app, store);
  app.onError((_error, context) => context.text("Internal Server Error", 500));

  return app;
};

export const createDatabaseBackedApp = ({
  databasePath,
  migrationsFolder,
  isProduction,
}: DatabaseBackedAppOptions): Hono => {
  const database = createSqliteDatabase(databasePath);
  migrateDatabase(database, migrationsFolder);

  return createApp(database, isProduction);
};
