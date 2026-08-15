import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { sessions, type SessionSummary } from "../../sessions/catalog";
import { createAstroContainer } from "../render-astro";

type PageModule = Readonly<{ default: AstroComponentFactory }>;

const pageModules = import.meta.glob<PageModule>("../../pages/sessions/*.astro", {
  eager: true,
});

export const renderSessionPage = async (
  session: SessionSummary,
): Promise<Document> => {
  const path = `../../pages/sessions/${session.slug}.astro`;
  const page = pageModules[path]?.default;
  if (page === undefined) {
    throw new Error(`Missing session page: ${session.slug}`);
  }

  const container = await createAstroContainer();
  const html = await container.renderToString(page, { partial: false });
  return new DOMParser().parseFromString(
    html.replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
    "text/html",
  );
};

export const sessionCases = sessions.map((session) => ({
  name: session.slug,
  session,
}));
