import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import { inertia } from "@hono/inertia";
import { Hono } from "hono";

import { registerClinicRoutes, resetDemo } from "./web/routes.js";

export const createApp = (isProduction = false): Hono => {
  resetDemo();
  const app = new Hono();

  app.use(
    "*",
    inertia({ version: "1", rootView: createClinicRootView(isProduction) }),
  );
  registerClinicRoutes(app);
  app.onError((_error, context) =>
    context.text("Internal Server Error", 500),
  );

  return app;
};
