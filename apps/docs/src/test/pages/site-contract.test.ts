import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import NotFoundPage from "../../pages/404.astro";
import { createAstroContainer } from "../render-astro";

const pageSessions = import.meta.glob("../../pages/sessions/*.astro", { eager: true });

describe("static site contract", () => {
  it("keeps the authored legacy routes until Task 5 replaces them with six wrappers", () => {
    const slugs = Object.keys(pageSessions)
      .map((path) => path.split("/").at(-1)?.replace(/\.astro$/, ""))
      .filter((slug): slug is string => slug !== undefined)
      .sort();

    expect(slugs).toEqual([
      "00-onboarding",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-agent-review",
      "05-mini-integration",
      "final",
    ]);
    expect(sessions.map(({ slug }) => slug)).toEqual([
      "00-onboarding",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-effects-and-events",
      "final",
    ]);
  });

  it("renders a real not-found page", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(NotFoundPage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");
    const scripts = document.querySelectorAll("script");

    expect(html).toContain("ページが見つかりません");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/sessions/00-onboarding/"');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).toContain('document.querySelector("h1")');
    expect(document.querySelector("script[src], astro-island")).toBeNull();
  });
});
