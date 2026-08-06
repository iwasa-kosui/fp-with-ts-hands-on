import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPage = (slug: string): string =>
  readFileSync(
    new URL("../../../pages/sessions/" + slug + ".astro", import.meta.url),
    "utf8",
  );

describe("Final example", () => {
  it("documents the completed Kamae package and its four-part walkthrough", () => {
    const page = readPage("final");

    expect(page).toContain("examples/final");
    expect(page).toContain('id="final-structure"');
    expect(page).toContain('id="final-flow"');
    expect(page).toContain('id="final-follow-up"');
    expect(page).toContain('id="final-verify"');
    expect(page).toContain("Appointment companion");
    expect(page).toContain("startExaminationUseCase");
    expect(page).toContain("collectFollowUpTargets");
    expect(page).toContain("Zod");
    expect(page).toContain("neverthrow");
    expect(page).toContain("Standard Schema");
    expect(page).toContain("@standard-schema/spec");
    expect(page).toContain("examples/final/src/shared/schema-result.ts");
    expect(page).toContain("UUID");
    expect(page).toContain("brand");
    expect(page).toContain("examples/final/src/domain/appointment-id.ts");
    expect(page).toContain("examples/final/src/domain/pet-id.ts");
    expect(page).toContain("examples/final/src/domain/owner-id.ts");
    expect(page).toContain("examples/final/src/domain/veterinarian-id.ts");
    expect(page).toContain("examples/final/src/domain/event-id.ts");
    expect(page).toContain("examples/final/src/domain/exam-id.ts");
    expect(page).toContain("save(state, events)");
    expect(page).toContain("Sensitive");
    expect(page).toContain("filter");
    expect(page).toContain("map");
    expect(page).toContain("reduce");
    expect(page).toContain(
      "pnpm --filter @fp-with-ts/clinic-final typecheck",
    );
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final test");
  });
});
