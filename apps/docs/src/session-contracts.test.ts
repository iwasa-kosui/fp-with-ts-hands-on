import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  paymentAmountQuote,
  supplementaryExercise,
} from "./pages/sessions/03-boundaries-and-pii.astro";
import { sessionNavigationItems } from "./sessions/navigation";
import { sessionPageEntries, sessionPageHref } from "./sessions/pages/links";
import { splitSessions } from "./sessions/pages/split-sessions.fixture";
import { sessionPageFlowOrder, splitPageRole } from "./sessions/pages/types";
import type { SessionNavigation, SessionSummary } from "./sessions/types";
type PageModule = Readonly<{
  session: SessionSummary;
  navigation?: SessionNavigation;
}>;

const pageModules = import.meta.glob<PageModule>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
});
const astroSources = import.meta.glob<string>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
  query: "?raw",
  import: "default",
});
const proseSources = import.meta.glob<string>("./sessions/prose/*.mdx", {
  eager: true,
  query: "?raw",
  import: "default",
});
const splitProseSources = import.meta.glob<string>("./sessions/prose/*/*.mdx", {
  eager: true,
  query: "?raw",
  import: "default",
});
const pageSources = Object.fromEntries(
  Object.entries(astroSources).map(([path, source]) => {
    const slug = path.replace(/^.*\//, "").replace(/\.astro$/, "");
    return [path, `${source}\n${proseSources[`./sessions/prose/${slug}.mdx`] ?? ""}`];
  }),
);
const pages = Object.entries(pageModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, page]) => ({ path, ...page }));
const sessions = pages.map(({ session }) => session);
const exerciseSessions = sessions.filter(
  (session) => session.kind === "exercise",
);

const expectedCurriculum = [
  {
    slug: "00-system-handover",
    sequence: "00",
    title: "業務とシステムを引き継ぐ",
    durationMinutes: 10,
    kind: "orientation",
    exerciseCommand: undefined,
    snapshot: "session-00",
    timeBreakdown: { brief: 4, teach: 3, exercise: 0, review: 3 },
  },
  {
    slug: "01-state-transitions",
    sequence: "01",
    title: "予約の状態と遷移をモデル化する",
    durationMinutes: 20,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:01",
    snapshot: "session-01",
    timeBreakdown: { brief: 3, teach: 6, exercise: 8, review: 3 },
  },
  {
    slug: "02-adt-and-exhaustiveness",
    sequence: "02",
    title: "予約の状態の分岐漏れを型で検出する",
    durationMinutes: 20,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:02",
    snapshot: "session-02",
    timeBreakdown: { brief: 3, teach: 7, exercise: 7, review: 3 },
  },
  {
    slug: "03-boundaries-and-pii",
    sequence: "03",
    title: "診察開始の入力を境界で検証する",
    durationMinutes: 35,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:03",
    snapshot: "session-03",
    timeBreakdown: { brief: 2, teach: 13, exercise: 15, review: 5 },
  },
  {
    slug: "04-workflow-errors",
    sequence: "04",
    title: "失敗をユースケースの結果として扱う",
    durationMinutes: 35,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:04",
    snapshot: "session-04",
    timeBreakdown: { brief: 4, teach: 13, exercise: 10, review: 8 },
  },
  {
    slug: "05-business-events-and-workflows",
    sequence: "05",
    title: "データとパイプラインで予約キャンセルを設計する",
    durationMinutes: 15,
    kind: "workshop",
    exerciseCommand: undefined,
    snapshot: undefined,
    timeBreakdown: { brief: 2, teach: 7, exercise: 4, review: 2 },
  },
  {
    slug: "06-effects-and-consistency",
    sequence: "06",
    title: "副作用と整合性境界を設計する",
    durationMinutes: 40,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:06",
    snapshot: "session-06",
    timeBreakdown: { brief: 4, teach: 13, exercise: 15, review: 8 },
  },
  {
    slug: "final",
    sequence: "Final",
    title: "参照実装で境界をたどる",
    durationMinutes: 5,
    kind: "reference",
    exerciseCommand: undefined,
    snapshot: "final",
    timeBreakdown: { brief: 0, teach: 4, exercise: 0, review: 1 },
  },
] as const;

const expectedEpisodes = [
  undefined,
  [
    "会計を終えたウサギは帰ったはずなのに、画面の中では診察室へ戻ってきました。",
    "受付画面は止めるどころか、2枚目の請求書まで手際よく用意します。",
    "許可された状態遷移を覚えていたのは人間だけで、コードは何でも通す危ない設計でした。",
  ],
  [
    "無断キャンセルを表すNoShowの状態を足した翌朝、受付画面のハリネズミの予約に「不明」と表示されていました。",
    "表示名の分岐にNoShowのcaseがなく、defaultが「不明」を返していても、型検査は成功しました。",
    "状態を足したときは、直し忘れた分岐をコンパイラに見つけさせる必要があります。",
  ],
  undefined,
  [
    "別の端末で受付情報が更新された後、古い画面に残っていたハムスターの診察開始ボタンを押すと、500エラーだけを返して止まりました。",
    "予約なしは専用表示になるのに、受付前の予約は想定外扱いです。後ろでは犬が吠え、列だけが伸びます。",
    "新しい例外を投げた側は、呼び出し側のcatch漏れを型から確かめられませんでした。",
  ],
  [
    "会計済みの予約を、受付担当者が誤ってキャンセルできました。",
    "理由のないキャンセルがStoreへ記録されましたが、開発者はどの条件を確認したのかを説明できません。",
    "実装へ進む前に、予約のデータと、キャンセルでデータがどう変わるかを確かめます。",
  ],
  [
    "カメの診察を開始すると、予約状態だけが先に更新され、監査記録はどこにも残りませんでした。",
    "再現テストでは時刻とイベント ID が毎回変わり、失敗したときの値を同じ形で確かめられません。",
    "状態の更新はすぐに終わりますが、監査記録の保存は別の処理です。そのため、原因を調べる作業だけが長引きます。",
  ],
  [
    "ここまで直した頃、猫のムギはとっくに帰宅し、開発者だけが参照実装の前に残っていました。",
    "入力、失敗、イベント、保存、例外を順に追うと、さっきまでの事故が、それぞれどの境界で防がれるかが見えてきます。",
    "完成形と呼んでも、事故が消えたわけではありません。置き場所と担当が決まっただけです。",
  ],
] as const;

const expectedExercises = [
  {
    slug: "01-state-transitions",
    adv: { articulate: 2, delegate: 4, verify: 2 },
    exerciseModule: {
      dir: "examples/session-01/src/domain/appointment",
      fileBudget: 1,
      lineBudget: 35,
    },
    solutionSnapshot: "session-01-solution",
    solutionPresentation: "excerpt",
    peerReviewPromises: "inline",
    peerReview: {
      minutes: 3,
      pickCount: 2,
      questions: [
        "`startExamination` は `CheckedIn` だけを受け取り、会計済み・キャンセル済みを型で拒否しますか。",
        "`recordPayment` は `AwaitingPayment` だけを受け取り、診察結果の記録前には会計できない型ですか。",
      ],
    },
  },
  {
    slug: "02-adt-and-exhaustiveness",
    adv: { articulate: 1, delegate: 5, verify: 1 },
    exerciseModule: {
      dir: "examples/session-02/src/domain/appointment",
      fileBudget: 1,
      lineBudget: 6,
    },
    solutionSnapshot: "session-02-solution",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 3,
      pickCount: 1,
      questions: [
        "状態を追加したとき、未対応の分岐はコンパイルエラーになりますか。",
        "`toStatusLabel` は `Readonly<{ kind: string }>` ではなく、`Appointment` を受け取っていますか。",
        "`default` 分岐は、固定の表示名を返して未対応の状態を隠していませんか。",
      ],
    },
  },
  {
    slug: "03-boundaries-and-pii",
    adv: { articulate: 2, delegate: 11, verify: 2 },
    exerciseModule: {
      dir: "examples/session-03/src/boundary",
      fileBudget: 1,
      lineBudget: 18,
    },
    solutionSnapshot: "session-03-solution",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 5,
      pickCount: 2,
      questions: [
        "不正な予約IDまたは獣医師IDを含む入力は、`StartExaminationInput` になりませんか。",
        "`parse` は外部入力を `unknown` として受け取っていますか。",
        "検証に成功した場合だけ、`AppointmentId` と `VeterinarianId` をユースケースへ渡せますか。",
      ],
    },
  },
  {
    slug: "04-workflow-errors",
    adv: { articulate: 2, delegate: 5, verify: 3 },
    exerciseModule: {
      dir: "examples/session-04/src",
      fileBudget: 3,
      lineBudget: 80,
    },
    solutionSnapshot: "session-04-solution",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 8,
      pickCount: 2,
      questions: [
        "予約なしと状態不正は、異なる `kind` を持つ `Err` になっていますか。",
        "`andThen` は、失敗後の状態遷移と保存を実行しない構造になっていますか。",
        "Web側は業務エラーを `kind` で網羅し、未対応の種類を型エラーにできますか。",
      ],
    },
  },
  {
    slug: "06-effects-and-consistency",
    adv: { articulate: 2, delegate: 10, verify: 3 },
    exerciseModule: {
      dir: "examples/session-06/src/useCase",
      fileBudget: 3,
      lineBudget: 55,
    },
    solutionSnapshot: "session-06-solution",
    solutionPresentation: "completed-file",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 8,
      pickCount: 2,
      questions: [
        "時刻とイベント ID は実行ごとに一度だけ生成され、同じ `EventContext` に入りますか。",
        "状態と監査記録は、1つのイベントとして同じ `store` に渡されますか。",
        "業務上の競合だけを `Result` で返し、保存障害は reject のまま伝播しますか。",
      ],
    },
  },
] as const;

const expectedNavigation = [
  {
    previous: undefined,
    next: {
      href: "/sessions/01-state-transitions/",
      title: "予約の状態と遷移をモデル化する",
    },
  },
  {
    previous: {
      href: "/sessions/00-system-handover/",
      title: "業務とシステムを引き継ぐ",
    },
    next: {
      href: "/sessions/02-adt-and-exhaustiveness/",
      title: "予約の状態の分岐漏れを型で検出する",
    },
  },
  {
    previous: {
      href: "/sessions/01-state-transitions/",
      title: "予約の状態と遷移をモデル化する",
    },
    next: {
      href: "/sessions/03-boundaries-and-pii/",
      title: "診察開始の入力を境界で検証する",
    },
  },
  {
    previous: {
      href: "/sessions/02-adt-and-exhaustiveness/",
      title: "予約の状態の分岐漏れを型で検出する",
    },
    next: {
      href: "/sessions/04-workflow-errors/",
      title: "失敗をユースケースの結果として扱う",
    },
  },
  {
    previous: {
      href: "/sessions/03-boundaries-and-pii/",
      title: "診察開始の入力を境界で検証する",
    },
    next: {
      href: "/sessions/05-business-events-and-workflows/",
      title: "データとパイプラインで予約キャンセルを設計する",
    },
  },
  {
    previous: {
      href: "/sessions/04-workflow-errors/",
      title: "失敗をユースケースの結果として扱う",
    },
    next: {
      href: "/sessions/06-effects-and-consistency/",
      title: "副作用と整合性境界を設計する",
    },
  },
  {
    previous: {
      href: "/sessions/05-business-events-and-workflows/",
      title: "データとパイプラインで予約キャンセルを設計する",
    },
    next: {
      href: "/sessions/final/",
      title: "参照実装で境界をたどる",
    },
  },
  {
    previous: {
      href: "/sessions/06-effects-and-consistency/",
      title: "副作用と整合性境界を設計する",
    },
    next: undefined,
  },
] as const satisfies readonly SessionNavigation[];

describe("page-owned session contracts", () => {
  it("keeps the complete curriculum metadata in page order", () => {
    expect(
      sessions.map((session) => ({
        slug: session.slug,
        sequence: session.sequence,
        title: session.title,
        durationMinutes: session.durationMinutes,
        kind: session.kind,
        exerciseCommand: session.exerciseCommand,
        snapshot: session.snapshot,
        timeBreakdown: session.timeBreakdown,
      })),
    ).toEqual(expectedCurriculum);
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(8);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(8);
  });

  it("keeps the session rail aligned with page-owned metadata", () => {
    expect(sessionNavigationItems).toEqual(
      sessions.map(({ slug, title }) => ({ slug, title })),
    );
  });

  it("keeps each three-line episode in its page metadata and hero", () => {
    expect(
      sessions.map((session) =>
        splitSessions.some(({ slug }) => slug === session.slug)
          ? undefined
          : "episode" in session
            ? session.episode
            : undefined,
      ),
    ).toEqual(expectedEpisodes);

    const handoverEpisode = sessions.find(
      ({ slug }) => slug === "00-system-handover",
    )?.episode;
    expect(handoverEpisode).toEqual([
      "新人エンジニアの初出勤の日、プリンターは事故報告を何枚も印刷していました。",
      "獣医師が別の予約と取り違えて「診察を開始する」を押し、会計済みの Mugi の予約は診察中へ戻りました。受付は同じ金額をもう一度請求しました。",
      "記録を調べると、飼い主の電話番号まで読めました。",
    ]);

    const boundaryEpisode = sessions.find(
      ({ slug }) => slug === "03-boundaries-and-pii",
    )?.episode;
    expect(boundaryEpisode).toHaveLength(3);
    expect(boundaryEpisode?.join("\n")).toContain("night-shift");
    expect(boundaryEpisode?.join("\n")).toContain("veterinarianId");
    expect(boundaryEpisode?.join("\n")).toContain("StartExaminationInput");

    for (const { path, session } of pages) {
      const split = splitSessions.find(({ slug }) => slug === session.slug);
      const isSplit = split !== undefined;
      const source =
        split === undefined
          ? (pageSources[path] ?? "")
          : split.sessionPages
              .map(
                ({ slug }) =>
                  splitProseSources[
                    `./sessions/prose/${split.slug}/${slug === "" ? "index" : slug}.mdx`
                  ] ?? "",
              )
              .join("\n");
      if (session.slug !== "00-system-handover") {
        expect(source, path).toContain('class="case-file__episode"');
        expect(source, path).toContain('class="case-file__episode-label"');
      }
      if (isSplit) continue;
      expect(source, path).toContain("session.episode.map");
    }
  });

  it("describes the Session 00 SQLite incident baseline without a legacy path", () => {
    const handover = sessions.find(({ slug }) => slug === "00-system-handover");
    const source = [
      ...Object.entries(splitProseSources)
        .filter(([path]) => path.startsWith("./sessions/prose/00-system-handover/"))
        .map(([, prose]) => prose),
      handover?.summary,
      handover?.incident,
    ].join("\n");

    expect(source).toContain("SQLite");
    expect(source).toContain("現在の予約内容");
    expect(source).toContain("監査記録");
    expect(source).toContain("個人情報");
    expect(source).not.toContain("src/legacy");
  });

  it("keeps the 180-minute schedule and each time allocation consistent", () => {
    expect(
      sessions.reduce((sum, { durationMinutes }) => sum + durationMinutes, 0),
    ).toBe(180);
    for (const session of sessions) {
      expect(
        Object.values(session.timeBreakdown).reduce(
          (sum, duration) => sum + duration,
          0,
        ),
        session.slug,
      ).toBe(session.durationMinutes);
    }
  });

  it("keeps the complete exercise, solution, and peer-review contracts", () => {
    expect(
      exerciseSessions.map((session) => ({
        slug: session.slug,
        adv: session.adv,
        exerciseModule: session.exerciseModule,
        solutionSnapshot: session.solutionSnapshot,
        solutionPresentation: session.solutionPresentation,
        peerReviewPromises: session.peerReviewPromises,
        peerReview: session.peerReview,
      })),
    ).toEqual(expectedExercises);

    for (const session of exerciseSessions) {
      expect(
        Object.values(session.adv).reduce((sum, value) => sum + value, 0),
        session.slug,
      ).toBe(session.timeBreakdown.exercise);
      expect(session.peerReview.minutes).toBe(session.timeBreakdown.review);
      expect(session.exerciseModule.fileBudget).toBeLessThanOrEqual(5);
      expect(session.exerciseModule.lineBudget).toBeLessThanOrEqual(80);
    }
  });

  it("keeps exercise targets and solutions inside their declared snapshots", () => {
    for (const session of exerciseSessions) {
      expect(session.steps.length).toBeGreaterThanOrEqual(1);
      expect(session.steps.length).toBeLessThanOrEqual(4);
      expect(session.decisions.length).toBeGreaterThanOrEqual(1);
      expect(session.decisions.length).toBeLessThanOrEqual(3);
      expect(session.incident.trim()).not.toBe("");

      for (const decision of session.decisions) {
        expect(decision.invariant.trim()).not.toBe("");
      }
      for (const step of session.steps) {
        expect(step.solutions.length).toBeGreaterThanOrEqual(1);
        for (const target of step.targets) {
          expect(target).toMatch(
            new RegExp(`^${session.exerciseModule.dir}/`),
          );
        }
        for (const solution of step.solutions) {
          expect(solution.path).toMatch(
            new RegExp(
              solution.sourcePath === undefined
                ? `^examples/${session.solutionSnapshot}/`
                : `^${session.exerciseModule.dir}/`,
            ),
          );
          expect(solution.presentation ?? "excerpt").toBe(
            session.solutionPresentation,
          );
        }
      }
    }

    const injectContext = exerciseSessions
      .find(({ slug }) => slug === "06-effects-and-consistency")
      ?.steps.find(({ id }) => id === "s06-inject-context");
    expect(injectContext?.solutions).toEqual([
      expect.objectContaining({
        path: "examples/session-06-solution/src/useCase/dependencies.ts",
        symbol: "EventContextDependencies",
      }),
      expect.objectContaining({
        path: "examples/session-06-solution/src/useCase/startExamination.ts",
        symbol: "createEventContext",
      }),
    ]);
  });

  it("keeps the semantic identifier supplementary exercise with its owning concepts", () => {
    const workflowErrors = exerciseSessions.find(
      ({ slug }) => slug === "04-workflow-errors",
    );

    expect(supplementaryExercise.exerciseCommand).toBe("pnpm exercise:03-supplement");
    expect(supplementaryExercise.solutionSnapshot).toBe("session-03-supplement-solution");
    expect(supplementaryExercise.steps[0]?.targets).toEqual([
      "examples/session-03-supplement/src/domain/appointment/appointmentId.ts",
      "examples/session-03-supplement/src/domain/appointment/veterinarianId.ts",
    ]);
    expect(supplementaryExercise.steps[0]?.solutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples/session-03-supplement-solution/src/domain/appointment/appointmentId.ts",
        }),
        expect.objectContaining({
          path: "examples/session-03-supplement-solution/src/domain/appointment/veterinarianId.ts",
        }),
      ]),
    );
    for (const step of supplementaryExercise.steps) {
      for (const target of step.targets) {
        expect(target).toMatch(
          new RegExp(`^${supplementaryExercise.exerciseModule.dir}/`),
        );
      }
      for (const solution of step.solutions) {
        expect(solution.path).toMatch(
          new RegExp(`^examples/${supplementaryExercise.solutionSnapshot}/`),
        );
      }
    }
    expect(workflowErrors?.steps.flatMap(({ targets }) => targets)).not.toContain(
      "examples/session-04/src/domain/ids/appointmentId.ts",
    );
  });

  it("quotes PaymentAmount verbatim from the final snapshot", async () => {
    const source = await readFile(
      resolve(process.cwd(), "../..", paymentAmountQuote.source),
      "utf8",
    );

    expect(source).toContain(paymentAmountQuote.code);
  });

  it("keeps exercise-only fields off non-exercise pages", () => {
    for (const session of sessions.filter(({ kind }) => kind !== "exercise")) {
      expect(session.adv).toBeUndefined();
      expect(session.peerReview).toBeUndefined();
      expect(session.exerciseCommand).toBeUndefined();
      expect(session.exerciseModule).toBeUndefined();
      expect(session.solutionSnapshot).toBeUndefined();
      expect(session.solutionPresentation).toBeUndefined();
      expect(session.peerReviewPromises).toBeUndefined();
      expect(session.steps).toHaveLength(0);
      expect(session.decisions).toHaveLength(0);
    }
  });

  it("keeps fixed previous and next navigation on all eight pages", () => {
    expect(pages.map(({ navigation }) => navigation)).toEqual(
      expectedNavigation,
    );
  });
});

describe.each(splitSessions)("Session page list: $slug", ({
  slug: sessionSlug,
  previous,
  previousTitle,
  next,
  nextTitle,
  expectedPages,
  lastInTime,
  sessionPages,
}) => {
  const entries = sessionPageEntries(sessionSlug, sessionPages);
  const hrefOf = (slug: string) => sessionPageHref(sessionSlug, slug);
  const timedCount = expectedPages.filter(([, , , kind]) => kind !== "advanced").length;
  const advancedCount = expectedPages.length - timedCount;

  it("lists the pages in the agreed order", () => {
    expect(
      sessionPages.map(({ slug, title, flow, kind, minutes }) => [
        slug,
        title,
        flow,
        kind,
        minutes,
      ]),
    ).toEqual(expectedPages);
    expect(new Set(sessionPages.map(({ slug }) => slug)).size).toBe(
      expectedPages.length,
    );
  });

  it("puts lastInTime on the last page that is not advanced", () => {
    expect(
      sessionPages.filter(({ kind }) => kind !== "advanced").at(-1)?.slug,
    ).toBe(lastInTime);
  });

  it("keeps the pages in the order of sessionPageFlowOrder", () => {
    const positions = sessionPages.map(({ flow }) =>
      sessionPageFlowOrder.indexOf(flow),
    );

    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });

  it("gives each page a role that starts with its stage", () => {
    for (const { slug, role } of sessionPages) {
      const { label, text } = splitPageRole(role);
      expect(label, slug).not.toBe("");
      expect(text, slug).not.toBe("");
    }
    expect(
      sessionPages.filter(({ flow }) => flow === "advanced").every(({ role }) =>
        role.startsWith("あとで読む: "),
      ),
    ).toBe(true);
  });

  it("keeps the page minutes aligned with the session time breakdown", () => {
    const sum = (kind: string) =>
      sessionPages
        .filter((page) => page.kind === kind)
        .reduce((total, { minutes }) => total + minutes, 0);
    const session = sessions.find(({ slug }) => slug === sessionSlug);

    expect(session?.timeBreakdown).toEqual({
      brief: sum("brief"),
      teach: sum("teach"),
      exercise: sum("exercise"),
      review: sum("review"),
    });
    if (session?.kind === "exercise") {
      expect(session.peerReview.minutes).toBe(sum("review"));
    }
    expect(session?.durationMinutes).toBe(
      sessionPages.reduce((total, { minutes }) => total + minutes, 0),
    );
    expect(sum("advanced")).toBe(0);
  });

  it("links each page to its neighbours and to the adjacent sessions", () => {
    entries.forEach(({ previous: actualPrevious, next: actualNext }, index) => {
      const slug = expectedPages[index]![0];
      const expectedPrevious =
        index === 0
          ? previous === undefined
            ? undefined
            : { href: previous, title: previousTitle }
          : { href: hrefOf(expectedPages[index - 1]![0]), title: expectedPages[index - 1]![1] };
      const expectedNext =
        slug === lastInTime || index === expectedPages.length - 1
          ? next === undefined
            ? undefined
            : { href: next, title: nextTitle }
          : { href: hrefOf(expectedPages[index + 1]![0]), title: expectedPages[index + 1]![1] };

      expect(actualPrevious, slug).toEqual(expectedPrevious);
      expect(actualNext, slug).toEqual(expectedNext);
    });
  });

  it("shows the advanced pages link only on the last in-time page", () => {
    const firstAdvanced = expectedPages.find(([, , , kind]) => kind === "advanced");

    expect(
      entries.flatMap(({ page, later }) =>
        later === undefined ? [] : [[page.slug, later]],
      ),
    ).toEqual(
      firstAdvanced === undefined
        ? []
        : [[lastInTime, { href: hrefOf(firstAdvanced[0]), count: advancedCount }]],
    );
  });

  it("counts positions inside the in-time pages and the advanced pages separately", () => {
    expect(entries.map(({ position }) => position)).toEqual([
      ...Array.from({ length: timedCount }, (_, index) => `${index + 1} / ${timedCount}`),
      ...Array.from(
        { length: advancedCount },
        (_, index) => `発展 ${index + 1} / ${advancedCount}`,
      ),
    ]);
  });
});
