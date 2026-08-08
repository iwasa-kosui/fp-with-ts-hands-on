import type { Hono } from "hono";

import type { GetDashboardUseCase } from "../../../../useCase/getDashboardUseCase.js";
import type { InstallationStatusQuery } from "../../../../useCase/query/installationStatusQuery.js";
import type { WebEnvironment } from "../pageProps.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  respondToUseCaseError,
} from "../middleware/useCaseResponse.js";

type DashboardRouteDependencies = Readonly<{
  installationStatusQuery: InstallationStatusQuery;
  getDashboard: GetDashboardUseCase;
}>;

export const registerDashboardRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: DashboardRouteDependencies,
): void => {
  app.get("/", async (context) => {
    const actor = context.get("actor");
    if (actor === undefined) {
      const installation = await dependencies.installationStatusQuery.get();
      if (installation.isErr()) {
        return respondToUseCaseError(context, { kind: "RepositoryError" });
      }
      return context.redirect(
        installation.value.kind === "InitialSetupAvailable"
          ? "/setup"
          : "/login",
      );
    }

    return dependencies.getDashboard
      .run({ actorUserId: actor.user.userId })
      .match(
        (dashboard) =>
          context.render(
            "Dashboard",
            withSharedProps(context, dashboard),
          ),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, {
                kind: "Unauthenticated",
              });
            case "RepositoryError":
              return respondToUseCaseError(context, {
                kind: "RepositoryError",
              });
            default:
              return assertNever(error);
          }
        },
      );
  });
};
