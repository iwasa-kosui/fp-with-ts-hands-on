import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { peerReviewQuestions, sessions } from "../../sessions/catalog";

const repositoryRoot = resolve(process.cwd(), "../..");

const readEventDocument = async (name: string): Promise<string> =>
  readFile(`${repositoryRoot}/docs/event/${name}`, "utf8").catch(() => "");

const uniqueMatches = (source: string, pattern: RegExp): string[] =>
  [...new Set([...source.matchAll(pattern)].map((match) => match[1] ?? ""))];

describe("event document contract", () => {
  it("keeps the six-session timetable aligned with the catalog", async () => {
    const guide = await readEventDocument("facilitator-guide.md");
    const timetable = [...guide.matchAll(/^\| (S[0-4]|Final) \| (\d+)分 \|/gm)].map(
      ([, label, minutes]) => ({ label, minutes: Number(minutes) }),
    );

    expect(timetable).toEqual(
      sessions.map((session) => ({
        label: session.sequence === "Final" ? "Final" : `S${Number(session.sequence)}`,
        minutes: session.durationMinutes,
      })),
    );
  });

  it("documents only the four exercise commands that exist at the root", async () => {
    const setup = await readEventDocument("participant-setup.md");
    const rootPackage = JSON.parse(
      await readFile(`${repositoryRoot}/package.json`, "utf8"),
    ) as Readonly<{ scripts: Readonly<Record<string, string>> }>;
    const documented = uniqueMatches(setup, /pnpm (exercise:\d{2})/g).sort();
    const available = Object.keys(rootPackage.scripts)
      .filter((script) => /^exercise:\d{2}$/.test(script))
      .sort();

    expect(documented).toEqual(available);
  });

  it("keeps review durations and the three questions aligned with the catalog", async () => {
    const card = await readEventDocument("peer-review-card.md");
    const reviewMinutes = [...card.matchAll(/^\| S([1-4]) \| (\d+)分 \|/gm)].map(
      ([, session, minutes]) => ({ session: Number(session), minutes: Number(minutes) }),
    );

    expect(reviewMinutes).toEqual(
      sessions
        .filter((session) => session.kind === "exercise")
        .map((session) => ({
          session: Number(session.sequence),
          minutes: session.peerReview?.minutes,
        })),
    );
    expect(peerReviewQuestions).toHaveLength(3);
    for (const question of peerReviewQuestions) expect(card).toContain(question);
  });

  it("provides one review-sheet row for every exercise", async () => {
    const sheet = await readEventDocument("review-sheet.md");
    const exerciseLabels = uniqueMatches(sheet, /^## (S[1-4]):/gm);

    expect(exerciseLabels).toEqual(["S1", "S2", "S3", "S4"]);
  });
});
