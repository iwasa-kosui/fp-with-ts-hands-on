import { resolveWorkerRoute } from "./routes";

type AssetsEnv = Readonly<{
  ASSETS: Pick<Fetcher, "fetch">;
}>;

export const handleRequest = async (
  request: Request,
  env: AssetsEnv,
): Promise<Response> => {
  const requestUrl = new URL(request.url);
  const route = resolveWorkerRoute(requestUrl.pathname);

  switch (route.kind) {
    case "health":
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    case "redirect": {
      const location = new URL(route.location, requestUrl);
      location.search = requestUrl.search;
      return Response.redirect(location, 308);
    }
    case "asset":
      return env.ASSETS.fetch(request);
  }
};

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
