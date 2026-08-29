import { createClinicRootView } from "@fp-with-ts/clinic-web/server";
import type { RootView } from "@hono/inertia";

export const createRootView = (isProduction: boolean): RootView =>
  createClinicRootView(
    isProduction,
    "/src/adaptor/primary/web/client.tsx",
  );
