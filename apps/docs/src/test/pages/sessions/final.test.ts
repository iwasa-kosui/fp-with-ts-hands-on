import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readPage = (slug: string): string =>
  readFileSync(
    new URL("../../../pages/sessions/" + slug + ".astro", import.meta.url),
    "utf8",
  );

describe("Final application", () => {
  it("documents the runnable clinic flow and the safeguards behind it", () => {
    const page = readPage("final");

    expect(page).toContain("examples/final");
    expect(page).toContain('id="final-structure"');
    expect(page).toContain('id="final-flow"');
    expect(page).toContain('id="final-operations"');
    expect(page).toContain('id="final-persistence"');
    expect(page).toContain('id="final-verify"');
    expect(page).toContain("domain");
    expect(page).toContain("adaptor/primary");
    expect(page).toContain("adaptor/secondary");
    expect(page).toContain("useCase");
    expect(page).toContain("app.ts");
    expect(page).toContain("StartExaminationUseCase");
    expect(page).toContain("ResultAsync");
    expect(page).toContain("resolveById");
    expect(page).toContain("examinationStartedStore.store(event)");
    expect(page).toContain("Drizzle");
    expect(page).toContain("transaction");
    expect(page).toContain("clinic.sqlite");
    expect(page).toContain("/setup");
    expect(page).toContain("/login");
    expect(page).toContain("Admin");
    expect(page).toContain("Receptionist");
    expect(page).toContain("Veterinarian");
    expect(page).toContain("EventHistoryReader");
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final dev");
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final build");
    expect(page).toContain(
      "pnpm --filter @fp-with-ts/clinic-final typecheck",
    );
    expect(page).toContain("pnpm --filter @fp-with-ts/clinic-final test");
  });
});
