import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sessions } from "../../sessions/catalog";
import NotFoundPage from "../../pages/404.astro";
import { createAstroContainer } from "../render-astro";

const pageSessions = import.meta.glob("../../pages/sessions/*.astro", { eager: true });
const staticBuildVerifier = readFileSync(
  resolve(process.cwd(), "scripts/verify-static-build.mjs"),
  "utf8",
);

describe("static site contract", () => {
  it("has one authored page for every catalog session", () => {
    const slugs = Object.keys(pageSessions)
      .map((path) => path.split("/").at(-1)?.replace(/\.astro$/, ""))
      .filter((slug): slug is string => slug !== undefined)
      .sort();

    expect(slugs).toHaveLength(sessions.length);
    expect(slugs).toEqual(sessions.map(({ slug }) => slug).slice().sort());
  });

  it("requires exactly the current catalog sessions from the static build", () => {
    const requiredSessionSlugs = [
      ...staticBuildVerifier.matchAll(/sessions\/([^/]+)\/index\.html/g),
    ]
      .map((match) => match[1])
      .filter((slug): slug is string => slug !== undefined)
      .sort();

    expect(requiredSessionSlugs).toEqual(
      sessions.map(({ slug }) => slug).slice().sort(),
    );
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
