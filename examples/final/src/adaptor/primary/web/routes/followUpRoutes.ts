import type { Context, Hono } from "hono";
import { err, ok, ResultAsync, type Result } from "neverthrow";
import { z } from "zod";

import { AppointmentId } from "../../../../domain/appointment/index.js";
import type {
  FollowUpView,
  ListFollowUpsUseCase,
} from "../../../../useCase/listFollowUpsUseCase.js";
import type { RequestFollowUpUseCase } from "../../../../useCase/requestFollowUpUseCase.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";
import type {
  AuthenticatedActor,
  FieldErrors,
  WebEnvironment,
} from "../pageProps.js";

const FollowUpSelectionSchema = z.object({
  appointmentIds: z.array(AppointmentId.schema).min(1),
});
const FollowUpErrorSchema = z.enum(["target-not-found", "request-conflict"]);

type FollowUpRouteDependencies = Readonly<{
  listFollowUps: ListFollowUpsUseCase;
  requestFollowUp: RequestFollowUpUseCase;
}>;
export type FollowUpPageView = Readonly<{
  appointmentId: FollowUpView["appointmentId"];
  petId: FollowUpView["petId"];
  ownerName: string;
  ownerPhone: string;
  requested: boolean;
}>;

const toPageView = (followUp: FollowUpView): FollowUpPageView => ({
  appointmentId: followUp.appointmentId,
  petId: followUp.petId,
  ownerName: followUp.ownerName?.unwrap() ?? "削除済み",
  ownerPhone: followUp.ownerPhone.unwrap(),
  requested: followUp.requested,
});

const requireClinicManager = (
  context: Context<WebEnvironment>,
): Result<AuthenticatedActor, Response> => {
  const actor = context.get("actor");
  if (actor === undefined) {
    return err(respondToUseCaseError(context, { kind: "Unauthenticated" }));
  }
  return actor.user.kind === "Admin" || actor.user.kind === "Receptionist"
    ? ok(actor)
    : err(respondToUseCaseError(context, { kind: "Unauthorized" }));
};

const queryErrors = (raw: string | undefined): FieldErrors => {
  const parsed = FollowUpErrorSchema.safeParse(raw);
  if (!parsed.success) return {};
  const code = parsed.data;
  switch (code) {
    case "target-not-found":
      return {
        form:
          "選択したフォローアップ対象が見つかりません。最新の一覧を確認してください。",
      };
    case "request-conflict":
      return {
        form:
          "フォローアップを依頼できませんでした。最新の一覧を確認してください。",
      };
    default:
      return assertNever(code);
  }
};

const loadFollowUps = async (
  context: Context<WebEnvironment>,
  dependencies: FollowUpRouteDependencies,
  errors: FieldErrors = {},
): Promise<Response> => {
  const actor = requireClinicManager(context);
  if (actor.isErr()) return actor.error;
  return dependencies.listFollowUps
    .run({ actorUserId: actor.value.user.userId })
    .match(
      ({ followUps }) =>
        context.render(
          "FollowUps/Index",
          withSharedProps(context, {
            followUps: followUps.map(toPageView),
            errors,
          }),
        ),
      (error) => {
        switch (error.kind) {
          case "Unauthorized":
            return respondToUseCaseError(context, { kind: "Unauthorized" });
          case "ExamResultPetMismatch":
            return respondToUseCaseError(context, { kind: "InternalServerError" });
          default:
            return assertNever(error);
        }
      },
    );
};

const parseSelection = (context: Context<WebEnvironment>) =>
  ResultAsync.fromPromise(
    context.req.formData(),
    (): ValidationError => ({
      kind: "ValidationError",
      errors: { form: "対象を選択してください。" },
    }),
  ).andThen((form) => {
    const appointmentIds = Array.from(form.entries())
      .filter(([key]) => key === "appointmentIds" || key.startsWith("appointmentIds["))
      .map(([, value]) => value);
    const parsed = FollowUpSelectionSchema.safeParse({
      appointmentIds,
    });
    return parsed.success
      ? ok(parsed.data)
      : err({
          kind: "ValidationError",
          errors: issuesToFieldErrors(parsed.error.issues),
        } as const satisfies ValidationError);
  });

export const registerFollowUpRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: FollowUpRouteDependencies,
): void => {
  app.get("/follow-ups", (context) =>
    loadFollowUps(
      context,
      dependencies,
      queryErrors(context.req.query("error")),
    ),
  );

  app.post("/follow-ups/request", async (context) => {
    const actor = requireClinicManager(context);
    if (actor.isErr()) return actor.error;
    const parsed = await parseSelection(context);
    if (parsed.isErr()) {
      return loadFollowUps(context, dependencies, parsed.error.errors);
    }
    return dependencies.requestFollowUp
      .run({
        actorUserId: actor.value.user.userId,
        appointmentIds: parsed.value.appointmentIds,
      })
      .match(
        () => context.redirect("/follow-ups", 303),
        (error) => {
          switch (error.kind) {
            case "Unauthorized":
              return respondToUseCaseError(context, { kind: "Unauthorized" });
            case "FollowUpTargetNotFound":
              return context.redirect("/follow-ups?error=target-not-found", 303);
            case "FollowUpRequestConflict":
              return context.redirect("/follow-ups?error=request-conflict", 303);
            case "ExamResultPetMismatch":
            case "IdentityGenerationFailed":
              return respondToUseCaseError(context, { kind: "InternalServerError" });
            default:
              return assertNever(error);
          }
        },
      );
  });
};
