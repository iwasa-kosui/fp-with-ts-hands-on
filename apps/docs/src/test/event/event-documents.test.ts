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

    const fixedSlots = [
      ...guide.matchAll(
        /^\| (\d+:\d+-\d+:\d+) \| \d+:\d+-\d+:\d+ \| (\d+)分 \|/gm,
      ),
    ].map(([, clock, minutes]) => ({
      clock: clockRange(clock ?? ""),
      minutes: Number(minutes),
    }));
    const sessionMinutes = timetable.reduce((total, row) => total + row.minutes, 0);
    const fixedMinutes = fixedSlots.reduce((total, row) => total + row.minutes, 0);

    expect(sessionMinutes).toBe(180);
    expect(fixedSlots).toHaveLength(1);
    expect(
      fixedSlots.map(({ clock, minutes }) => ({
        elapsed: clock.end - clock.start,
        declared: minutes,
      })),
    ).toEqual([{ elapsed: 30, declared: 30 }]);
    expect(fixedMinutes).toBe(30);
    expect(sessionMinutes + fixedMinutes).toBe(210);

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

  it("keeps the root README aligned with the current public curriculum", async () => {
    const readme = await readFile(`${repositoryRoot}/README.md`, "utf8");
    const overview = readme.match(/## 演習の構成\n\n([\s\S]*?)\n\n## 当日の流れ/)?.[1] ?? "";
    const dayFlow = readme.match(/## 当日の流れ\n\n([\s\S]*)/)?.[1] ?? "";
    const orientation = sessions.find((session) => session.kind === "orientation");
    const workshop = sessions.find((session) => session.kind === "workshop");
    const expectedCommands = exerciseSessions.map((session) => session.exerciseCommand).sort();

    expect(overview).toContain(`S0 は${orientation?.durationMinutes}分のオリエンテーション`);
    expect(overview).toContain(`S1 は${workshop?.durationMinutes}分の班ワーク`);
    expect(overview).toMatch(/S1[^。]*(?:コード編集|exercise command)[^。]*行いません/);
    expect(overview).toContain("S2〜S6 は各30分のコード演習");
    expect(overview).toContain("`examples/session-07` は非公開の到達点スナップショット");
    expect(uniqueMatches(overview, /(pnpm exercise:\d{2})/g).sort()).toEqual(expectedCommands);
    expect(overview).toMatch(/S2〜S6[^。]*各starter[^。]*RED/);
    expect(overview).not.toMatch(/S1[^。]*(?:starter|開始時)[^。]*RED/);
    expect(dayFlow).toContain("Final は環境構築や DB 操作をせず、講師が参照実装の5つの境界を案内する");
    expect(dayFlow).not.toContain("3差分");
  });

  it("keeps the non-code S1 worksheet aligned with the event storming vocabulary and steps", async () => {
    const readme = await readFile(
      `${repositoryRoot}/examples/session-01/README.md`,
      "utf8",
    );

    expect(readme).toContain("3+4+6+2=15分");
    for (const vocabulary of ["ドメインイベント", "コマンド", "ワークフロー"]) {
      expect(readme).toContain(vocabulary);
    }
    for (const step of [
      "起きた出来事を過去形で書き出す",
      "時間の順に並べる",
      "それぞれの出来事が、誰の何の依頼で起きたかを添える",
      "同じ集約を変えるドメインイベントをまとめ、集約に名前を付ける",
    ]) {
      expect(readme).toContain(step);
    }
    for (const removedPrompt of [
      "何が起きたことで始まるか",
      "どこへ何を保存・通知するか",
    ]) {
      expect(readme).not.toContain(removedPrompt);
    }
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

  it("keeps every event handoff scoped to the current catalog snapshot", async () => {
    const expectedCommands = exerciseSessions.map(
      (session) => `git diff --stat -- examples/${session.snapshot}`,
    );
    const handoffDocuments = [
      "facilitator-guide.md",
      "participant-setup.md",
      "peer-review-card.md",
      "review-sheet.md",
    ];

    for (const name of handoffDocuments) {
      const document = await readEventDocument(name);
      expect(
        uniqueMatches(document, /(git diff --stat -- examples\/session-\d+)/g).sort(),
        name,
      ).toEqual([...expectedCommands].sort());
      expect(document, name).toContain("git status --short");
      expect(document, name).toContain("前のセッションの未commit差分");
      expect(document, name).toContain("reset、stash、commit");
    }

    for (const name of (await readdir(eventDocumentsDirectory)).filter((value) =>
      value.endsWith(".md"))) {
      expect(await readEventDocument(name), name).not.toContain("`git diff --stat`");
    }
  });

  it("prepares the PRD 30-day follow-up without claiming it was sent", async () => {
    const prd = await readFile(`${repositoryRoot}/docs/prd/prd-001.md`, "utf8");
    const followUp = await readEventDocument("follow-up-30-days.md");
    const guide = await readEventDocument("facilitator-guide.md");
    const rehearsal = await readEventDocument("rehearsal-2026-08-15.md");
    const measurementPlan = prd.match(/### 30日後\n\n([\s\S]*?)\n\n## /)?.[1] ?? "";
    const prdQuestions = [...measurementPlan.matchAll(/^- (.+)$/gm)].map(([, value]) => value);

    expect(prdQuestions).toHaveLength(4);
    for (const question of prdQuestions) expect(followUp).toContain(question);
    for (const value of [
      "主催者",
      "運営責任者",
      "D+30",
      "回答締切",
      "参加募集に使ったイベント管理サービス",
      "一斉連絡",
      "未回答者",
      "PII",
    ]) {
      expect(followUp).toContain(value);
    }
    const delivery = followUp.match(
      /## 送付方法と回答導線\n\n([\s\S]*?)\n\n## 設問/,
    )?.[1] ?? "";
    expect(delivery).toContain("当日参加が確認された登録者");
    expect(delivery).toMatch(/出席済み[\s\S]*当日参加リスト/);
    expect(delivery).toMatch(
      /filterできない[\s\S]*受付記録[\s\S]*当日参加者だけ[\s\S]*BCC/,
    );
    expect(delivery).toMatch(/抽出したPII[\s\S]*リポジトリ[\s\S]*D\+35[\s\S]*削除/);
    expect(delivery).not.toContain("参加登録者全員を宛先");
    expect(followUp).toMatch(/送付母集団[\s\S]*当日の全参加者/);
    expect(followUp).toMatch(/欠席登録者[\s\S]*成功指標の分子へ加え/);
    expect(guide).toContain("./follow-up-30-days.md");
    expect(rehearsal).toContain("./follow-up-30-days.md");
    for (const document of [guide, rehearsal]) {
      expect(document).toContain("設問と送付方法は準備済み");
      expect(document).toContain("実送付は開催後のため未実施");
    }
  });

  it("describes the solution details fallback used by each exercise page", async () => {
    for (const name of ["facilitator-guide.md", "troubleshooting.md"]) {
      const document = await readEventDocument(name);

      expect(document, name).toMatch(
        /S2〜S5[^。]*「ステップごとの解答」[^。]*`details`/,
      );
      expect(document, name).toMatch(/S6[^。]*後続step[^。]*完成ファイル/);
    }
  });

  it("rejects stale curriculum terms in every event markdown document", async () => {
    const names = (await readdir(eventDocumentsDirectory))
      .filter((name) => name.endsWith(".md"))
      .sort();
    const staleTerms = [
      /04-agent-review/,
      /05-mini-integration/,
      /exercise:0(?:0|1|[7-9])/,
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
