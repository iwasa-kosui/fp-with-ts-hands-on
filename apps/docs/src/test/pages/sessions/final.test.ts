import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import FinalPage from "../../../pages/sessions/final.astro";
import { createAstroContainer } from "../../render-astro";

const readFinal = (): string =>
  readFileSync(resolve("src/pages/sessions/final.astro"), "utf8");

describe("Final application", () => {
  it("routes from incidents to code before explaining framework composition", () => {
    const page = readFinal();
    const state = page.indexOf("appointment.ts");
    const boundary = page.indexOf("schemaResult.ts");
    const decision = page.indexOf("startExaminationUseCase.ts");
    const persistence = page.indexOf("appointmentEventStore.ts");
    const framework = page.indexOf("Hono");

    expect(Math.min(state, boundary, decision, persistence)).toBeGreaterThan(-1);
    expect(Math.max(state, boundary, decision, persistence)).toBeLessThan(framework);
    expect(page).toContain("SessionLayout");
    expect(page).toContain("sessionBySlug");
    expect(page).not.toContain("CommandBlock");
    expect(page).toContain("SessionCodePlayground");
  });

  it("renders the four incident routes as a read-only comparison", async () => {
    const container = await createAstroContainer();
    const html = await container.renderToString(FinalPage, { partial: false });
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelectorAll("#incident-routes li")).toHaveLength(4);
    expect(html).toContain("状態の事故");
    expect(html).toContain("境界の事故");
    expect(html).toContain("判断の事故");
    expect(html).toContain("永続化の事故");
    expect(html).toContain("Hono");
    expect(html).toContain("Inertia");
    expect(html).toContain("Drizzle");
    expect(html).toContain("src/adaptor/primary/web/routes/appointmentRoutes.ts");
    expect(html).toContain("読み取り専用の参照ツアー");
    expect(html).toContain("Session 13 で green にした演習");
    expect(html).not.toContain("pnpm --filter @fp-with-ts/clinic-final test");
    expect(document.querySelector("#final-reflection textarea")).not.toBeNull();
  });
});
