import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { createInMemoryExaminationStartedStore } from "./adaptor/inMemoryExaminationStartedStore.js";
import { registerClinicRoutes, session07InitialAppointment } from "./web/routes.js";

export type CreateAppOptions = Readonly<{
  failStore?: boolean;
  isProduction?: boolean;
}>;

export const createApp = (options: CreateAppOptions = {}): Hono => {
  const app = new Hono();
  const adapter = createInMemoryExaminationStartedStore(
    [session07InitialAppointment],
    options.failStore === true
      ? { beforeCommit: () => Promise.reject(new Error("Storage unavailable")) }
      : {},
  );
  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(options.isProduction === true) }),
  );
  registerClinicRoutes(app, adapter);
  app.onError((_error, context) => context.text("Internal Server Error", 500));
  return app;
};
