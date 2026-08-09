import type { Hono } from "hono";

import { EventId } from "../../../../domain/aggregate/eventId.js";
import type { ListEventsUseCase } from "../../../../useCase/listEventsUseCase.js";
import type { RevealSensitiveAuditPayloadUseCase } from "../../../../useCase/revealSensitiveAuditPayloadUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  respondToUseCaseError,
} from "../middleware/useCaseResponse.js";
import type { WebEnvironment } from "../pageProps.js";

type EventRouteDependencies = Readonly<{
  listEvents: ListEventsUseCase;
  revealSensitiveAuditPayload: RevealSensitiveAuditPayloadUseCase;
}>;

const secureSensitiveResponse = (headers: Headers): void => {
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Vary", "Cookie");
};

export const registerEventRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: EventRouteDependencies,
): void => {
  app.get("/events", (context) => {
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    return dependencies.listEvents
      .run({ actorUserId: actor.user.userId })
      .match(
        ({ events }) =>
          context.render(
            "Events/Index",
            withSharedProps(context, { events }),
          ),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "RepositoryError":
              return respondToUseCaseError(context, { kind: "RepositoryError" });
            default:
              return assertNever(error);
          }
        },
      );
  });

  app.post("/events/:eventId/sensitive-payload", (context) => {
    const actor = context.get("actor");
    if (actor === undefined) {
      return respondToUseCaseError(context, { kind: "Unauthenticated" });
    }
    if (actor.user.kind !== "Admin") {
      return respondToUseCaseError(context, { kind: "UnauthorizedDisclosure" });
    }
    const targetEventId = EventId.parse(context.req.param("eventId"));
    if (targetEventId.isErr()) {
      return respondToUseCaseError(context, { kind: "NotFound" });
    }
    return dependencies.revealSensitiveAuditPayload
      .run({ actorUserId: actor.user.userId, targetEventId: targetEventId.value })
      .match(
        (payload) => {
          secureSensitiveResponse(context.res.headers);
          return context.json(payload);
        },
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "UnauthorizedDisclosure" });
            case "AuditEventNotFound":
              return respondToUseCaseError(context, { kind: "NotFound" });
            case "AuditPayloadNotSensitive":
              return respondToUseCaseError(context, { kind: "Conflict" });
            case "RepositoryError":
              return respondToUseCaseError(context, { kind: "RepositoryError" });
            default:
              return assertNever(error);
          }
        },
      );
  });
};
