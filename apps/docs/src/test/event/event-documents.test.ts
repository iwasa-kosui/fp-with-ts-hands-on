import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  businessReflectionQuestion,
  peerReviewPromises,
  peerReviewQuestions,
  reviewCompletionArtifacts,
  sessions,
} from "../../sessions/catalog";

const repositoryRoot = resolve(process.cwd(), "../..");
const eventDocumentsDirectory = `${repositoryRoot}/docs/event`;

const readEventDocument = async (name: string): Promise<string> =>
  readFile(`${eventDocumentsDirectory}/${name}`, "utf8").catch(() => "");

const sessionLabel = (sequence: (typeof sessions)[number]["sequence"]): string =>
  sequence === "Final" ? sequence : `S${Number(sequence)}`;

const exerciseSessions = sessions.filter((session) => session.kind === "exercise");

const uniqueMatches = (source: string, pattern: RegExp): string[] =>
  [...new Set([...source.matchAll(pattern)].map((match) => match[1] ?? ""))];

const markdownCells = (row: string): string[] =>
  row.split("|").slice(1, -1).map((cell) => cell.trim());

const clockRange = (cell: string): Readonly<{ start: number; end: number }> => {
  const match = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(cell);
  expect(match, `invalid clock range: ${cell}`).not.toBeNull();
  const [, startHour = "0", startMinute = "0", endHour = "0", endMinute = "0"] = match ?? [];
  return {
    start: Number(startHour) * 60 + Number(startMinute),
    end: Number(endHour) * 60 + Number(endMinute),
  };
};

const minutesFromRange = (
  cell: string,
): Readonly<{ start: number; end: number; declared: number }> => {
  const match = /^(\d+):(\d+)-(\d+):(\d+)（(\d+)分）$/.exec(cell);
  expect(match, `invalid operation range: ${cell}`).not.toBeNull();
  const [, startHour = "0", startMinute = "0", endHour = "0", endMinute = "0", declared = "0"] =
    match ?? [];
  return {
    start: Number(startHour) * 60 + Number(startMinute),
    end: Number(endHour) * 60 + Number(endMinute),
    declared: Number(declared),
  };
};

describe("event document contract", () => {
  it("keeps the timetable, time breakdown, and ADV switching times aligned with the catalog", async () => {
    const guide = await readEventDocument("facilitator-guide.md");
    const timetable = [
      ...guide.matchAll(
        /^\| (S\d+|Final) \| (\d+)分 \| [^|]+ \| (\d+:\d+-\d+:\d+) \|/gm,
      ),
    ].map(([, label, minutes, clock]) => ({
      label,
      minutes: Number(minutes),
      clock: clockRange(clock ?? ""),
    }));

    expect(timetable.map(({ label, minutes }) => ({ label, minutes }))).toEqual(
      sessions.map((session) => ({
        label: sessionLabel(session.sequence),
        minutes: session.durationMinutes,
      })),
    );

    const breakdown = [
      ...guide.matchAll(
        /^\| (S\d+|Final) \| `([^`]+)` \| (\d+)分 \| (\d+)分 \| (\d+)分 \| (\d+)分 \| (\d+)分 \|$/gm,
      ),
    ].map(([, label, kind, brief, teach, exercise, review, total]) => ({
      label,
      kind,
      brief: Number(brief),
      teach: Number(teach),
      exercise: Number(exercise),
      review: Number(review),
      total: Number(total),
    }));

    expect(breakdown).toEqual(
      sessions.map((session) => ({
        label: sessionLabel(session.sequence),
        kind: session.kind,
        ...session.timeBreakdown,
        total: session.durationMinutes,
      })),
    );
    for (const row of breakdown) {
      expect(row.brief + row.teach + row.exercise + row.review).toBe(row.total);
    }

    const operationRows = guide
      .split("\n")
      .filter((line) => /^\| S\d+ \|/.test(line))
      .map(markdownCells)
      .filter((cells) => cells.length === 7 && cells.slice(1).every((cell) => /（\d+分）$/.test(cell)));

    expect(operationRows.map(([label]) => label)).toEqual(
      exerciseSessions.map((session) => sessionLabel(session.sequence)),
    );

    operationRows.forEach(([label = "", ...phaseCells], index) => {
      const session = exerciseSessions[index];
      expect(session).toBeDefined();
      if (session === undefined) return;

      const ranges = phaseCells.map(minutesFromRange);
      const expectedDurations = [
        session.timeBreakdown.brief,
        session.timeBreakdown.teach,
        session.adv.articulate,
        session.adv.delegate,
        session.adv.verify,
        session.timeBreakdown.review,
      ];
      expect(ranges.map((range) => range.declared), label).toEqual(expectedDurations);
      expect(ranges.map((range) => range.end - range.start), label).toEqual(expectedDurations);
      expect(ranges.slice(1).map((range) => range.start), label).toEqual(
        ranges.slice(0, -1).map((range) => range.end),
      );
      const firstRange = ranges[0];
      const lastRange = ranges.at(-1);
      expect(firstRange, label).toBeDefined();
      expect(lastRange, label).toBeDefined();
      if (firstRange === undefined || lastRange === undefined) return;
      expect(lastRange.end - firstRange.start, label).toBe(session.durationMinutes);
      const timetableRange = timetable.find((row) => row.label === label)?.clock;
      expect(timetableRange, label).toBeDefined();
      expect({ start: firstRange.start, end: lastRange.end }, label).toEqual(timetableRange);
    });
  });

  it("derives the exercise labels and commands from the catalog and root scripts", async () => {
    const setup = await readEventDocument("participant-setup.md");
    const rootPackage = JSON.parse(
      await readFile(`${repositoryRoot}/package.json`, "utf8"),
    ) as Readonly<{ scripts: Readonly<Record<string, string>> }>;
    const documentedRows = [
      ...setup.matchAll(/^\| (S\d+) \| `(pnpm exercise:\d{2})` \|$/gm),
    ].map(([, label, command]) => ({ label, command }));
    const expectedRows = exerciseSessions.map((session) => ({
      label: sessionLabel(session.sequence),
      command: session.exerciseCommand,
    }));

    expect(documentedRows).toEqual(expectedRows);
    expect(uniqueMatches(setup, /pnpm (exercise:\d{2})/g).sort()).toEqual(
      expectedRows.map(({ command }) => command.replace("pnpm ", "")).sort(),
    );
    expect(
      Object.keys(rootPackage.scripts)
        .filter((script) => /^exercise:\d{2}$/.test(script))
        .sort(),
    ).toEqual(expectedRows.map(({ command }) => command.replace("pnpm ", "")).sort());
  });

  it("keeps review durations, questions, and promises aligned with the catalog", async () => {
    const card = await readEventDocument("peer-review-card.md");
    const reviewMinutes = [...card.matchAll(/^\| (S\d+) \| (\d+)分 \|/gm)].map(
      ([, label, minutes]) => ({ label, minutes: Number(minutes) }),
    );

    expect(reviewMinutes).toEqual(
      exerciseSessions.map((session) => ({
        label: sessionLabel(session.sequence),
        minutes: session.peerReview.minutes,
      })),
    );

    const questionSection = card.match(
      /### 参加者へ投げる3つの問い\n\n([\s\S]*?)\n\n(?:問い1|###)/,
    )?.[1] ?? "";
    expect([...questionSection.matchAll(/^\d+\. (.+)$/gm)].map(([, value]) => value)).toEqual(
      [...peerReviewQuestions],
    );

    const promiseSection = card.match(
      /### 進行上の約束事\n\n([\s\S]*?)\n\n## /,
    )?.[1] ?? "";
    expect(peerReviewPromises).toHaveLength(5);
    expect([...promiseSection.matchAll(/^\d+\. (.+)$/gm)].map(([, value]) => value)).toEqual(
      [...peerReviewPromises],
    );
  });

  it("derives review-sheet rows and completion prompts from the catalog", async () => {
    const sheet = await readEventDocument("review-sheet.md");
    const exerciseLabels = uniqueMatches(sheet, /^## (S\d+):/gm);

    expect(exerciseLabels).toEqual(
      exerciseSessions.map((session) => sessionLabel(session.sequence)),
    );
    expect(reviewCompletionArtifacts).toHaveLength(3);
    for (const artifact of reviewCompletionArtifacts) expect(sheet).toContain(artifact);
    expect(sheet).toContain(businessReflectionQuestion);
  });

  it("rejects stale curriculum terms in every event markdown document", async () => {
    const names = (await readdir(eventDocumentsDirectory))
      .filter((name) => name.endsWith(".md"))
      .sort();
    const staleTerms = [
      /04-agent-review/,
      /05-mini-integration/,
      /exercise:0[05]/,
      /ミニ総合演習/,
      /collectFollowUpTargets/,
      /\/code-explorer\//,
      /最大\s*2\s*関数/,
      /1\s*(?:〜|～|-|–)\s*2\s*関数/,
    ];

    for (const name of names) {
      const document = await readEventDocument(name);
      for (const staleTerm of staleTerms) {
        expect(document, `${name}: ${staleTerm}`).not.toMatch(staleTerm);
      }
    }
  });
});
