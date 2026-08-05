import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "./module-content";
import { moduleBySlug, moduleNeighbors, modules } from "./modules";

describe("module registry", () => {
  it("keeps the seven modules in workshop order and every module satisfies the shared PRD contract", () => {
    expect(modules.map(({ slug }) => slug)).toEqual([
      "00-break-the-app",
      "00-read-the-incident",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-agent-review",
      "05-mini-integration",
    ]);

    for (const module of modules) {
      expect(() => assertModuleMeetsPrd(module)).not.toThrow();
    }
  });

  it("makes the final exercise one local integration loop with fallback and two action-plan prompts", () => {
    const finalModule = moduleBySlug("05-mini-integration");

    expect(finalModule).toMatchObject({
      editTargets: [{ file: "src/clinic/use-cases.ts", symbol: "collectFollowUpTargets" }],
      red: { command: "pnpm --filter @fp-with-ts/clinic-example exercise:05" },
      green: { command: "pnpm --filter @fp-with-ts/clinic-example exercise:05" },
      workedExamples: [
        { file: "src/clinic/use-cases.ts", symbols: ["collectFollowUpTargets"] },
      ],
      finalActionPlan: {
        implementationPrompt: "自分の業務コードで最初に見直す実装箇所を書いてください。",
        firstActionPrompt: "その箇所で最初に試す行動を書いてください。",
      },
    });
  });

  it("returns both neighbors for a module in the middle", () => {
    expect(moduleNeighbors("02-boundary-and-ids")).toMatchObject({
      previous: { slug: "01-state-modeling" },
      next: { slug: "03-result-errors" },
    });
  });

  it("omits the missing neighbor at each registry boundary and for an unknown slug", () => {
    expect(moduleNeighbors("00-break-the-app")).toMatchObject({
      next: { slug: "00-read-the-incident" },
    });
    expect(moduleNeighbors("00-break-the-app")).not.toHaveProperty("previous");
    expect(moduleNeighbors("05-mini-integration")).toMatchObject({
      previous: { slug: "04-agent-review" },
    });
    expect(moduleNeighbors("05-mini-integration")).not.toHaveProperty("next");
    expect(moduleNeighbors("not-a-module")).toEqual({});
  });
});
