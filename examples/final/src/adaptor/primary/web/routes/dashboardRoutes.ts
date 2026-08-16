import type { Hono } from "hono";

import type { GetDashboardUseCase } from "../../../../useCase/getDashboardUseCase.js";
import type { InstallationStatusQuery } from "../../../../domain/installation/installationStatusQuery.js";
import { resolveInstallationStatus } from "../installationStatus.js";
import type { WebEnvironment } from "../pageProps.js";
import { toAppointmentPageView } from "./appointmentRoutes.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import { respondToUseCaseError } from "../middleware/useCaseResponse.js";

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
      const installation = await resolveInstallationStatus(
        dependencies.installationStatusQuery,
      );
      return context.redirect(
        installation.kind === "InitialSetupAvailable"
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
            withSharedProps(context, {
              counts: dashboard.counts,
              activeAppointments: dashboard.activeAppointments.map(
                (appointment) => {
                  const pageView = toAppointmentPageView(appointment);
                  return {
                    appointmentId: pageView.appointmentId,
                    kind: pageView.kind,
                    petName: pageView.petName,
                    scheduledAt: pageView.scheduledAt,
                  };
                },
              ),
            }),
          ),
        () =>
          respondToUseCaseError(context, { kind: "Unauthenticated" }),
      );
  });
};
