export type Env = Readonly<{
  ASSETS: Fetcher;
}>;

export default {
  fetch: (request: Request, env: Env): Response | Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
