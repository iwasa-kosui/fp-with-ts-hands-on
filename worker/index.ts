import { resolveWorkerRoute } from "./routes";

type AssetsEnv = Readonly<{
  ASSETS: Pick<Fetcher, "fetch">;
}>;

export const handleRequest = async (
  request: Request,
  env: AssetsEnv,
): Promise<Response> => {
  const route = resolveWorkerRoute(new URL(request.url).pathname);

  switch (route.kind) {
    case "health":
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    case "redirect":
      return Response.redirect(new URL(route.location, request.url), 308);
    case "asset":
      return env.ASSETS.fetch(request);
  }
};

export default {
  fetch: handleRequest,
} satisfies ExportedHandler<Env>;
