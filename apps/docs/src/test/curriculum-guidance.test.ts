import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepositoryDocument = (path: string): string =>
  readFileSync(resolve(process.cwd(), "../..", path), "utf8");

const prd = readRepositoryDocument("docs/prd/prd-001.md");
const facilitatorGuide = readRepositoryDocument("docs/event/facilitator-guide.md");
const participantSetup = readRepositoryDocument("docs/event/participant-setup.md");
const troubleshooting = readRepositoryDocument("docs/event/troubleshooting.md");
const agentsGuide = readRepositoryDocument("AGENTS.md");

describe("curriculum guidance", () => {
  it("keeps the PRD aligned with the 00–13 plus Final curriculum", () => {
    expect(prd).toContain("00〜13＋Final");
    expect(prd).toContain("AwaitingPayment");
    expect(prd).toContain("ResultAsync");
    expect(prd).toContain("180分");
  });

  it("gives the facilitator a 180-minute route with an observation-first fallback", () => {
    expect(facilitatorGuide).toContain("180分");
    expect(facilitatorGuide).toContain("`11-use-case-ports`");
    expect(facilitatorGuide).toContain("実装を行わず");
    expect(facilitatorGuide).toContain("不変条件の選択");
    expect(facilitatorGuide).toContain("レビュー");
  });

  it("directs participants to the numbered exercises and distinguishes their failures", () => {
    expect(participantSetup).toContain("pnpm exercise:00");
    expect(participantSetup).toContain("pnpm exercise:13");
    expect(troubleshooting).toContain("exercise:* の失敗");
  });

  it("describes the snapshot examples instead of the removed clinic package", () => {
    expect(agentsGuide).toContain("examples/session-13");
    expect(agentsGuide).toContain("examples/final");
    expect(agentsGuide).not.toContain("packages/clinic-example");
  });
});
