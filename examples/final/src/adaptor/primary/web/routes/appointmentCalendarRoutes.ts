import type { Context, Hono } from "hono";
import { err, ok, type Result } from "neverthrow";

import { BusinessDate } from "../../../../domain/appointment/businessDate.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import type { Clock } from "../../../../domain/aggregate/clock.js";
import type { ListAppointmentCalendarUseCase } from "../../../../useCase/listAppointmentCalendarUseCase.js";
import type { ListVeterinariansUseCase } from "../../../../useCase/listVeterinariansUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import { assertNever, respondToUseCaseError } from "../middleware/useCaseResponse.js";
import type { AuthenticatedActor, WebEnvironment } from "../pageProps.js";

type Dependencies = Readonly<{
  clock: Clock;
  listAppointmentCalendar: ListAppointmentCalendarUseCase;
  listVeterinarians: ListVeterinariansUseCase;
}>;

const requireActor = (context: Context<WebEnvironment>): Result<AuthenticatedActor, Response> => {
  const actor = context.get("actor");
  return actor === undefined
    ? err(respondToUseCaseError(context, { kind: "Unauthenticated" }))
    : ok(actor);
};

const requestedView = (value: string | undefined): "day" | "week" | null =>
  value === "day" || value === "week" ? value : null;

export const registerAppointmentCalendarRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: Dependencies,
): void => {
  app.get("/appointments", async (context) => {
    const actor = requireActor(context);
    if (actor.isErr()) return actor.error;
    const parsedDate = BusinessDate.schema.safeParse(context.req.query("date"));
    const date = parsedDate.success ? parsedDate.data : BusinessDate.fromTimestamp(dependencies.clock.now());
    const view = requestedView(context.req.query("view"));
    const includeCanceled = context.req.query("canceled") === "1";
    const veterinarianResult = await dependencies.listVeterinarians.run({ actorUserId: actor.value.user.userId });
    if (veterinarianResult.isErr()) {
      return respondToUseCaseError(context, { kind: veterinarianResult.error.kind === "Unauthorized" ? "Unauthorized" : "RepositoryError" });
    }
    const veterinarians = veterinarianResult.value.veterinarians.map((veterinarian) => ({
      veterinarianId: veterinarian.veterinarianId,
      name: veterinarian.name.unwrap(),
    }));
    const parsedVeterinarianId = VeterinarianId.schema.safeParse(context.req.query("veterinarianId"));
    const selectedVeterinarianId = parsedVeterinarianId.success && veterinarians.some((veterinarian) => veterinarian.veterinarianId === parsedVeterinarianId.data)
      ? parsedVeterinarianId.data
      : null;
    const calendar = await dependencies.listAppointmentCalendar.run({
      actorUserId: actor.value.user.userId,
      date,
      view: view ?? "week",
      veterinarianId: selectedVeterinarianId,
      includeCanceled,
    });
    return calendar.match(
      ({ appointments }) => context.render("Appointments/Index", withSharedProps(context, {
        date,
        requestedView: view,
        appointments,
        veterinarians,
        selectedVeterinarianId,
        includeCanceled,
      })),
      (error) => {
        switch (error.kind) {
          case "Unauthorized": return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "RepositoryError": return respondToUseCaseError(context, { kind: "RepositoryError" });
          default: return assertNever(error);
        }
      },
    );
  });
};
