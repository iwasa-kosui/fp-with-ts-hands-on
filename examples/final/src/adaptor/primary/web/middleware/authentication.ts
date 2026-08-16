import { createHash } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { err, ok, safeTry, type Result, type ResultAsync } from "neverthrow";
import { z } from "zod";

import type { Clock } from "../../../../domain/aggregate/clock.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { Session } from "../../../../domain/session/session.js";
import type { SessionByTokenHashResolver } from "../../../../domain/session/sessionResolver.js";
import { SessionTokenHash } from "../../../../domain/session/sessionTokenHash.js";
import type { User } from "../../../../domain/user/user.js";
import type { UserByIdResolver } from "../../../../domain/user/userResolver.js";
import type { UseCaseOk as SessionResult } from "../../../../useCase/logInUseCase.js";
import type { AuthenticatedActor, WebEnvironment } from "../pageProps.js";

export const sessionCookieName = "clinic_session";

const SessionTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);

export type AuthenticationDependencies = Readonly<{
  sessionResolver: SessionByTokenHashResolver;
  userResolver: UserByIdResolver;
  clock: Clock;
  isProduction: boolean;
}>;

const cookieOptions = (isProduction: boolean) => ({
  path: "/",
  httpOnly: true,
  sameSite: "Lax" as const,
  secure: isProduction,
});

export const clearSessionCookie = (
  context: Context,
  isProduction: boolean,
): void => {
  deleteCookie(context, sessionCookieName, cookieOptions(isProduction));
};

export const setSessionCookie = (
  context: Context,
  session: SessionResult,
  clock: Clock,
  isProduction: boolean,
): void => {
  const maxAge = Math.max(
    0,
    Math.floor(
      (Date.parse(session.expiresAt) - Date.parse(clock.now())) / 1_000,
    ),
  );
  setCookie(
    context,
    sessionCookieName,
    session.sessionToken.unwrap(),
    { ...cookieOptions(isProduction), maxAge },
  );
};

const tokenHashFrom = (token: string) =>
  SessionTokenHash.schema.safeParse(
    createHash("sha256").update(token).digest("hex"),
  );

type AuthenticationFailure =
  | Readonly<{ kind: "SessionCookieMissing" }>
  | Readonly<{ kind: "SessionCookieInvalid" }>
  | Readonly<{ kind: "SessionUnavailable" }>
  | Readonly<{ kind: "UserUnavailable" }>;

type AuthenticationOutcome =
  | Readonly<{ kind: "Unauthenticated" }>
  | Readonly<{ kind: "ClearSessionCookie" }>
  | Readonly<{ kind: "Authenticated"; actor: AuthenticatedActor }>;

const parseSessionCookie = (
  rawToken: string | undefined,
): Result<SessionTokenHash, AuthenticationFailure> => {
  if (rawToken === undefined) {
    return err({ kind: "SessionCookieMissing" });
  }

  const token = SessionTokenSchema.safeParse(rawToken);
  if (!token.success) {
    return err({ kind: "SessionCookieInvalid" });
  }

  const tokenHash = tokenHashFrom(token.data);
  return tokenHash.success
    ? ok(tokenHash.data)
    : err({ kind: "SessionCookieInvalid" });
};

const ensureActiveSession =
  (clock: Clock) =>
  (session: Session | undefined): Result<Session, AuthenticationFailure> =>
    session === undefined ||
    Date.parse(session.expiresAt) <= Date.parse(clock.now())
      ? err({ kind: "SessionUnavailable" })
      : ok(session);

const ensureUser = (
  user: User | undefined,
): Result<User, AuthenticationFailure> =>
  user === undefined ? err({ kind: "UserUnavailable" }) : ok(user);

const resolveActor =
  (dependencies: AuthenticationDependencies) =>
  (rawToken: string | undefined): ResultAsync<
    AuthenticatedActor,
    AuthenticationFailure
  > =>
    safeTry<AuthenticatedActor, AuthenticationFailure>(async function* () {
      const tokenHash = yield* parseSessionCookie(rawToken);
      const session = yield* dependencies.sessionResolver.resolveByTokenHash(
        tokenHash,
      );
      const activeSession = yield* ensureActiveSession(dependencies.clock)(
        session,
      );
      const user = yield* dependencies.userResolver.resolveById(
        activeSession.userId,
      );
      const authenticatedUser = yield* ensureUser(user);
      return ok({ user: authenticatedUser, session: activeSession });
    });

const toUnauthenticatedOutcome = (
  failure: AuthenticationFailure,
): AuthenticationOutcome =>
  failure.kind === "SessionCookieMissing"
    ? { kind: "Unauthenticated" }
    : { kind: "ClearSessionCookie" };

const resolveAuthenticationOutcome =
  (dependencies: AuthenticationDependencies) =>
  (rawToken: string | undefined): Promise<AuthenticationOutcome> =>
    resolveActor(dependencies)(rawToken).match(
      (actor) => ({ kind: "Authenticated", actor }),
      toUnauthenticatedOutcome,
    );

const applyAuthenticationOutcome = (
  context: Context<WebEnvironment>,
  isProduction: boolean,
  outcome: AuthenticationOutcome,
): void => {
  switch (outcome.kind) {
    case "Unauthenticated":
      context.set("actor", undefined);
      return;
    case "ClearSessionCookie":
      context.set("actor", undefined);
      clearSessionCookie(context, isProduction);
      return;
    case "Authenticated":
      context.set("actor", outcome.actor);
      return;
    default:
      assertNever(outcome);
  }
};

export const createAuthenticationMiddleware = (
  dependencies: AuthenticationDependencies,
): MiddlewareHandler<WebEnvironment> =>
  async (context, next) => {
    const outcome = await resolveAuthenticationOutcome(dependencies)(
      getCookie(context, sessionCookieName),
    );
    applyAuthenticationOutcome(context, dependencies.isProduction, outcome);
    await next();
  };
