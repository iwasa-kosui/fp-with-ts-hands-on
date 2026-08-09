import { createHash } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { z } from "zod";

import type { Clock } from "../../../../domain/aggregate/clock.js";
import type { SessionByTokenHashResolver } from "../../../../domain/session/sessionResolver.js";
import { SessionTokenHash } from "../../../../domain/session/sessionTokenHash.js";
import type { UserByIdResolver } from "../../../../domain/user/userResolver.js";
import type { UseCaseOk as SessionResult } from "../../../../useCase/logInUseCase.js";
import type { WebEnvironment } from "../pageProps.js";

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

export const createAuthenticationMiddleware = (
  dependencies: AuthenticationDependencies,
): MiddlewareHandler<WebEnvironment> =>
  async (context, next) => {
    context.set("actor", undefined);
    const rawToken = getCookie(context, sessionCookieName);
    if (rawToken === undefined) {
      await next();
      return;
    }

    const token = SessionTokenSchema.safeParse(rawToken);
    if (!token.success) {
      clearSessionCookie(context, dependencies.isProduction);
      await next();
      return;
    }

    const tokenHash = tokenHashFrom(token.data);
    if (!tokenHash.success) {
      clearSessionCookie(context, dependencies.isProduction);
      await next();
      return;
    }

    const sessionResult = await dependencies.sessionResolver
      .resolveByTokenHash(tokenHash.data);
    if (sessionResult.isErr()) {
      return context.text("Internal Server Error", 500);
    }
    const session = sessionResult.value;
    if (
      session === undefined ||
      Date.parse(session.expiresAt) <= Date.parse(dependencies.clock.now())
    ) {
      clearSessionCookie(context, dependencies.isProduction);
      await next();
      return;
    }

    const userResult = await dependencies.userResolver.resolveById(
      session.userId,
    );
    if (userResult.isErr()) {
      return context.text("Internal Server Error", 500);
    }
    if (userResult.value === undefined) {
      clearSessionCookie(context, dependencies.isProduction);
      await next();
      return;
    }

    context.set("actor", { user: userResult.value, session });
    await next();
  };
