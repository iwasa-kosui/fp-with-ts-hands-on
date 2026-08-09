import type { Context, MiddlewareHandler } from "hono";

import {
  toAuthenticatedUserView,
  type SharedPageProps,
  type WebEnvironment,
} from "../pageProps.js";

export const createSharedPropsMiddleware =
  (): MiddlewareHandler<WebEnvironment> => async (context, next) => {
    const actor = context.get("actor");
    context.set("sharedProps", {
      auth: {
        user:
          actor === undefined
            ? null
            : toAuthenticatedUserView(actor.user),
      },
      flash: {},
      errors: {},
    });
    await next();
  };

export const withSharedProps = <T extends Readonly<Record<string, unknown>>>(
  context: Context<WebEnvironment>,
  props: T,
): SharedPageProps & T => ({
  ...context.get("sharedProps"),
  ...props,
});
