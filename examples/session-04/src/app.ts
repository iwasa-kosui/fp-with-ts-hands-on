import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createInMemoryAppointmentStore } from "./adaptor/inMemoryAppointmentStore.js";
import { registerClinicRoutes, session04InitialAppointment } from "./web/routes.js";

export const createApp = (isProduction = false): Hono => {
  const app = new Hono();
  const store = createInMemoryAppointmentStore(session04InitialAppointment);

  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(isProduction) }),
  );
  registerClinicRoutes(app, store);
  app.onError((_error, context) => context.text("Internal Server Error", 500));

  return app;
};
