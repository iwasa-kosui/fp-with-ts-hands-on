import type { MiddlewareHandler } from "hono";

import type { WebEnvironment } from "../pageProps.js";

export const createViteHtmlMiddleware = (
  isProduction: boolean,
): MiddlewareHandler<WebEnvironment> =>
  async (context, next) => {
    await next();

    const vite = context.env?.vite;
    const contentType = context.res.headers.get("content-type");
    if (
      isProduction ||
      vite === undefined ||
      !contentType?.startsWith("text/html")
    ) {
      return;
    }

    const response = context.res;
    const html = await response.text();
    const transformedHtml = await vite.transformIndexHtml(context.req.url, html);
    const headers = new Headers(response.headers);
    headers.delete("content-length");

    context.res = new Response(transformedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
