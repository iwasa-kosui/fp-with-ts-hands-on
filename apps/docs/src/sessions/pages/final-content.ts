import type { CodeGuide } from "../../code-explorer/code-guide";
import { loadSolutionSnippets } from "../solution-snippets";
import type { SessionNavigation, SessionSummary } from "../types";

export const finalAggregateTour = {
  label: "1業務集約 → 7業務集約",
  path: "examples/final/src/app.ts",
  aggregates: [
    "予約",
    "診察結果",
    "フォローアップ",
    "飼い主",
    "ペット",
    "セッション",
    "ユーザー",
  ],
};

export const guides = ([
  {
    id: "final-use-case-pipeline",
    title: "最初に読む ResultAsync パイプライン",
    currentDesign:
      "Session 04 で学んだ形を、認可と永続化を含むユースケースへ広げています。",
    futureRisk: "全体から読むと概念が多いため、まず run の処理だけを追います。",
    path: "src/useCase/startExaminationUseCase.ts",
    highlights: [{ startLineNumber: 76, endLineNumber: 94 }],
  },
  {
    id: "final-seven-aggregates",
    title: "1業務集約から7つの集約へ広がる配線",
    currentDesign: `${finalAggregateTour.aggregates.join("・")}の7つの集約を、app.ts でまとめて組み立てています。`,
    futureRisk:
      "個別ファイルから読み始めると集約どうしのつながりが見えないため、app.ts から辿ります。",
    path: finalAggregateTour.path.replace("examples/final/", ""),
    highlights: [{ startLineNumber: 202, endLineNumber: 244 }],
  },
  {
    id: "final-transaction-store",
    title: "in-memory から SQLite transaction へ広がる",
    currentDesign: "状態更新とイベント追加を1つの transaction で行います。",
    futureRisk: "単純な dual-write へ戻すと、状態と監査記録が分離します。",
    path: "src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
    highlights: [{ startLineNumber: 144, endLineNumber: 157 }],
  },
] as const) satisfies readonly CodeGuide[];

export const session: SessionSummary = {
  slug: "final",
  snapshot: "final",
  sequence: "Final",
  kind: "reference",
  title: "参照実装で境界をたどる",
  durationMinutes: 10,
  timeBreakdown: { brief: 0, teach: 6, exercise: 0, review: 4 },
  animal: { name: "Mugi", type: "cat", avatar: "🐈" },
  summary: "ここまでの学習内容を、より大きな参照実装へ接続します。",
  episode: [
    "S00 で飼い主がもう一度請求された猫の Mugi は、とっくに帰宅しました。",
    "開発者は、直した形が大きなコードでも保たれているかを確かめるため、参照実装の前に残っています。",
    "事故が消えたわけではありません。事故ごとに、防ぐ場所が決まりました。",
  ],
  incident: "各セッションで行った改善を、実運用を想定した構成へどう接続するかを確認する。",
  steps: [],
  decisions: [],
  finalReferences: [
    "examples/final/src/useCase/startExaminationUseCase.ts",
    finalAggregateTour.path,
  ],
};

export const navigation = ({
  previous: {
    href: "/sessions/06-effects-and-consistency/",
    title: "副作用と整合性境界を設計する",
  },
  next: undefined,
} as SessionNavigation);

const portsAndAdaptersSnippets = await loadSolutionSnippets({
  solutions: [
    {
      path: "examples/final/src/domain/appointment/appointmentStores.ts",
      symbol: "ExaminationStartedStore",
      lines: [16, 21],
    },
    {
      path: "examples/final/src/useCase/startExaminationUseCase.ts",
      symbol: "Dependencies",
      lines: [45, 51],
    },
    {
      path: "examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
      symbol: "createAppointmentEventStore",
      lines: [144, 157],
    },
    {
      path: "examples/final/src/app.ts",
      symbol: "startExamination",
      lines: [408, 414],
    },
    {
      path: "examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts",
      symbol: "startExamination",
      lines: [496, 497],
    },
  ],
});
const [portSnippet, dependenciesSnippet, secondarySnippet, assemblySnippet, routeSnippet] =
  portsAndAdaptersSnippets;
export const portsAndAdaptersCode = {
  port: portSnippet,
  dependencies: dependenciesSnippet,
  secondary: secondarySnippet,
  assembly: { ...assemblySnippet, code: assemblySnippet.code.replace(/^ {4}/gm, "") },
  route: { ...routeSnippet, code: routeSnippet.code.replace(/^ {4}/gm, "") },
};

const storeDifferencesSnippets = await loadSolutionSnippets({
  solutions: [
    {
      path: "examples/session-06-solution/src/adaptor/secondary/sqlite/examinationStartedStore.ts",
      symbol: "storeAtomically",
      lines: [148, 156],
    },
    {
      path: "examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
      symbol: "createAppointmentEventStore",
      lines: [173, 180],
    },
    {
      path: "examples/session-06-solution/src/adaptor/secondary/sqlite/examinationStartedStore.ts",
      symbol: "store",
      lines: [185, 188],
    },
    {
      path: "examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
      symbol: "createAppointmentEventStore",
      lines: [204, 209],
    },
    {
      path: "examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
      symbol: "createAppointmentEventStore",
      lines: [220, 224],
    },
    {
      path: "examples/session-06-solution/src/useCase/dependencies.ts",
      symbol: "ExaminationStartedStore",
      lines: [28, 30],
    },
    {
      path: "examples/final/src/domain/appointment/appointmentStores.ts",
      symbol: "ExaminationStartedStore",
      lines: [16, 21],
    },
  ],
});
const [
  s06UpdateSnippet,
  finalUpdateSnippet,
  s06ConflictSnippet,
  finalThrowSnippet,
  finalConvertSnippet,
  s06PortSnippet,
  finalPortSnippet,
] = storeDifferencesSnippets;

const dedent = (code: string) => {
  const indents = code
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => line.length - line.trimStart().length);
  const common = Math.min(...indents);
  return code
    .split("\n")
    .map((line) => line.slice(common))
    .join("\n");
};
const snippetOf = (
  ...snippets: readonly Readonly<{ solution: { path: string }; code: string }>[]
) => ({
  code: snippets.map(({ code }) => dedent(code)).join("\n\n"),
  path: snippets[0]!.solution.path,
});

export const storeDifferencesCode = {
  s06Update: snippetOf(s06UpdateSnippet),
  finalUpdate: snippetOf(finalUpdateSnippet),
  s06Conflict: snippetOf(s06ConflictSnippet),
  finalConflict: snippetOf(finalThrowSnippet, finalConvertSnippet),
  s06Port: snippetOf(s06PortSnippet),
  finalPort: snippetOf(finalPortSnippet),
};
