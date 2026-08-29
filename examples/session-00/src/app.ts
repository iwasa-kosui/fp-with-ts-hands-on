import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createAppointmentStore } from "./adaptor/secondary/sqlite/appointmentStore.js";
import type { SqliteDatabase } from "./adaptor/secondary/sqlite/db.js";
import { initialAppointment, registerClinicRoutes } from "./web/routes.js";

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
