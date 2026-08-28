import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createInMemoryAppointmentStore } from "./adaptor/inMemoryAppointmentStore.js";
import { registerClinicRoutes, session06InitialAppointment } from "./web/routes.js";

export type CreateAppOptions = Readonly<{
  failEventLog?: boolean;
  isProduction?: boolean;
}>;

export const createApp = (options: CreateAppOptions = {}): Hono => {
  const app = new Hono();
  const store = createInMemoryAppointmentStore(
    session06InitialAppointment,
    options.failEventLog === true ? { failEventLog: true } : {},
  );
  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(options.isProduction === true) }),
  );
  registerClinicRoutes(app, store);
  app.onError((_error, context) => context.text("Internal Server Error", 500));
  return app;
};
