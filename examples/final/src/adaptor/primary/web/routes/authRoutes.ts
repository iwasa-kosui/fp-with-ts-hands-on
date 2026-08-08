import type { Context, Hono } from "hono";
import { err, ok, ResultAsync } from "neverthrow";
import { z } from "zod";

import { Sensitive } from "../../../../domain/shared/sensitive.js";
import { UserEmail } from "../../../../domain/user/userEmail.js";
import { UserName } from "../../../../domain/user/userName.js";
import type { Clock } from "../../../../domain/aggregate/clock.js";
import type { LogInUseCase } from "../../../../useCase/logInUseCase.js";
import type { LogOutUseCase } from "../../../../useCase/logOutUseCase.js";
import type { SetUpInitialAdminUseCase } from "../../../../useCase/setUpInitialAdminUseCase.js";
import type { InstallationStatusQuery } from "../../../../useCase/query/installationStatusQuery.js";
import type { WebEnvironment } from "../pageProps.js";
import {
  clearSessionCookie,
  setSessionCookie,
} from "../middleware/authentication.js";
import { withSharedProps } from "../middleware/sharedProps.js";
import {
  assertNever,
  issuesToFieldErrors,
  respondToUseCaseError,
  type ValidationError,
} from "../middleware/useCaseResponse.js";

const PlaintextPasswordSchema = z
  .string()
  .min(12)
  .max(200)
  .transform(Sensitive.of);
const SetupFormSchema = z.object({
  email: UserEmail.schema,
  name: UserName.schema,
  password: PlaintextPasswordSchema,
});
const LoginFormSchema = z.object({
  email: UserEmail.schema,
  password: PlaintextPasswordSchema,
});

type AuthRouteDependencies = Readonly<{
  installationStatusQuery: InstallationStatusQuery;
  setUpInitialAdmin: SetUpInitialAdminUseCase;
  logIn: LogInUseCase;
  logOut: LogOutUseCase;
  clock: Clock;
  isProduction: boolean;
}>;

const parseForm = <TOutput, TInput>(
  context: Context<WebEnvironment>,
  schema: z.ZodType<TOutput, z.ZodTypeDef, TInput>,
) =>
  ResultAsync.fromPromise(
    context.req.parseBody(),
    (): ValidationError => ({
      kind: "ValidationError",
      errors: { form: "入力内容を確認してください" },
    }),
  ).andThen((body) => {
    const parsed = schema.safeParse(body);
    return parsed.success
      ? ok(parsed.data)
      : err({
          kind: "ValidationError",
          errors: issuesToFieldErrors(parsed.error.issues),
        } as const satisfies ValidationError);
  });

const getInstallationStatus = (dependencies: AuthRouteDependencies) =>
  dependencies.installationStatusQuery.get();

export const registerAuthRoutes = (
  app: Hono<WebEnvironment>,
  dependencies: AuthRouteDependencies,
): void => {
  app.get("/setup", async (context) => {
    const installation = await getInstallationStatus(dependencies);
    if (installation.isErr()) {
      return respondToUseCaseError(context, { kind: "RepositoryError" });
    }
    if (installation.value.kind === "Installed") {
      return context.redirect(
        context.get("actor") === undefined ? "/login" : "/",
      );
    }
    return context.render("Setup", withSharedProps(context, {}));
  });

  app.post("/setup", async (context) => {
    const installation = await getInstallationStatus(dependencies);
    if (installation.isErr()) {
      return respondToUseCaseError(context, { kind: "RepositoryError" });
    }
    if (installation.value.kind === "Installed") {
      return context.redirect("/login");
    }

    const parsed = await parseForm(context, SetupFormSchema);
    if (parsed.isErr()) {
      return respondToUseCaseError(context, parsed.error, {
        validation: (errors) =>
          context.render(
            "Setup",
            withSharedProps(context, { errors }),
            { url: "/setup" },
          ),
      });
    }

    return dependencies.setUpInitialAdmin.run(parsed.value).match(
      (session) => {
        setSessionCookie(
          context,
          session,
          dependencies.clock,
          dependencies.isProduction,
        );
        return context.redirect("/");
      },
      (error) => {
        switch (error.kind) {
          case "InitialAdminAlreadyExists":
            return context.redirect("/login");
          case "PasswordHashingFailed":
          case "IdentityGenerationFailed":
          case "SessionCreationFailed":
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

  app.get("/login", async (context) => {
    const installation = await getInstallationStatus(dependencies);
    if (installation.isErr()) {
      return respondToUseCaseError(context, { kind: "RepositoryError" });
    }
    if (installation.value.kind === "InitialSetupAvailable") {
      return context.redirect("/setup");
    }
    if (context.get("actor") !== undefined) {
      return context.redirect("/");
    }
    return context.render("Login", withSharedProps(context, {}));
  });

  app.post("/login", async (context) => {
    const installation = await getInstallationStatus(dependencies);
    if (installation.isErr()) {
      return respondToUseCaseError(context, { kind: "RepositoryError" });
    }
    if (installation.value.kind === "InitialSetupAvailable") {
      return context.redirect("/setup");
    }

    const parsed = await parseForm(context, LoginFormSchema);
    if (parsed.isErr()) {
      return respondToUseCaseError(context, parsed.error, {
        validation: (errors) =>
          context.render(
            "Login",
            withSharedProps(context, { errors }),
            { url: "/login" },
          ),
      });
    }

    return dependencies.logIn.run(parsed.value).match(
      (session) => {
        setSessionCookie(
          context,
          session,
          dependencies.clock,
          dependencies.isProduction,
        );
        return context.redirect("/");
      },
      (error) => {
        switch (error.kind) {
          case "InvalidCredentials":
            return context.render(
              "Login",
              withSharedProps(context, {
                errors: {
                  credentials:
                    "メールアドレスまたはパスワードが正しくありません",
                },
              }),
              { url: "/login" },
            );
          case "PasswordVerificationFailed":
          case "SessionCreationFailed":
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

  app.post("/logout", async (context) => {
    const actor = context.get("actor");
    if (actor === undefined) {
      const installation = await getInstallationStatus(dependencies);
      if (installation.isErr()) {
        return respondToUseCaseError(context, { kind: "RepositoryError" });
      }
      return context.redirect(
        installation.value.kind === "InitialSetupAvailable"
          ? "/setup"
          : "/login",
      );
    }

    return dependencies.logOut
      .run({
        actorUserId: actor.user.userId,
        sessionId: actor.session.sessionId,
      })
      .match(
        () => {
          clearSessionCookie(context, dependencies.isProduction);
          return context.redirect("/login");
        },
        (error) => {
          switch (error.kind) {
            case "SessionNotFound":
              clearSessionCookie(context, dependencies.isProduction);
              return context.redirect("/login");
            case "Unauthorized":
              return respondToUseCaseError(context, {
                kind: "Unauthorized",
              });
            case "SessionInvalidationFailed":
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
