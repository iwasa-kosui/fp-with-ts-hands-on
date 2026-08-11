import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import OnboardingPage from "../../../pages/sessions/00-onboarding.astro";
import { createAstroContainer } from "../../render-astro";

describe("Session 00 onboarding page", () => {
  it("starts with the inherited incident and introduces the shared learning loop", async () => {
    const source = readFileSync(resolve("src/pages/sessions/00-onboarding.astro"), "utf8");
    expect(source).toContain("CommandBlock");
    expect(source).toContain("SessionCodePlayground");
    expect(source).toContain("pnpm exercise:00");
    expect(source).toContain("examples/session-00/exercises/incident.test.ts");

    const container = await createAstroContainer();
    const html = await container.renderToString(OnboardingPage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(html).toContain("会計済みの来院を診察中へ戻せる");
    expect(html).toContain("PII");
    expect(html).toContain("事故から始める");
    expect(document.querySelector("#incident [data-actor]")?.textContent).toContain("院長");
    expect(document.querySelector("#learning-loop")?.textContent).toContain("最大2関数");
    expect(document.querySelector('a[rel="next"]')?.getAttribute("href")).toBe(
      "/sessions/01-invariants/",
    );
  });
});
