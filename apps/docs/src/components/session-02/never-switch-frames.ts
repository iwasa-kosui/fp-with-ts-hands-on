export type Candidate = "Scheduled" | "CheckedIn" | "Canceled" | "NoShow";

export type Card = Readonly<{ name: Candidate; done: boolean; forgotten?: boolean }>;

export type Verdict = Readonly<
  { kind: "ok"; label: string } | { kind: "error"; label: string; message: string }
>;

export type Frame = Readonly<{
  code: string;
  lit: readonly number[];
  negative: readonly number[];
  dimAfter?: number;
  cards: readonly Card[];
  showNever: boolean;
  verdict?: Verdict;
  caption: string;
}>;

const labels = {
  Scheduled: "予約済み",
  CheckedIn: "来院済み",
  Canceled: "キャンセル",
} as const;

const codeFor = (names: readonly Candidate[]): string =>
  [
    `type Status = ${names.map((name) => `"${name}"`).join(" | ")};`,
    "",
    "const toStatusLabel = (status: Status): string => {",
    "  switch (status) {",
    `    case "Scheduled": return "${labels.Scheduled}";`,
    `    case "CheckedIn": return "${labels.CheckedIn}";`,
    `    case "Canceled": return "${labels.Canceled}";`,
    "    default: {",
    "      const rest: never = status;",
    "      return rest;",
    "    }",
    "  }",
    "};",
  ].join("\n");

const threeNames: readonly Candidate[] = ["Scheduled", "CheckedIn", "Canceled"];
const fourNames: readonly Candidate[] = [...threeNames, "NoShow"];
const threeCode = codeFor(threeNames);
const fourCode = codeFor(fourNames);

const lineOf = (code: string, needle: string): number => {
  const index = code.split("\n").findIndex((line) => line.includes(needle));
  if (index < 0) throw new Error(`never-switch-frames: "${needle}" is not in the code`);
  return index;
};

const typeLine = lineOf(threeCode, "type Status");
const scheduledLine = lineOf(threeCode, 'case "Scheduled"');
const checkedInLine = lineOf(threeCode, 'case "CheckedIn"');
const canceledLine = lineOf(threeCode, 'case "Canceled"');
const defaultLine = lineOf(threeCode, "default: {");
const restLine = lineOf(threeCode, "const rest: never");

const cardsFor = (names: readonly Candidate[], doneCount: number): readonly Card[] =>
  names.map((name, index) => ({ name, done: index < doneCount }));

const cardsWithForgotten = (names: readonly Candidate[], doneCount: number): readonly Card[] =>
  names.map((name, index) => ({ name, done: index < doneCount, forgotten: index >= doneCount }));

export const noShowError = `Type '"NoShow"' is not assignable to type 'never'.`;

export const frames: readonly Frame[] = [
  {
    code: threeCode,
    lit: [typeLine],
    negative: [],
    cards: cardsFor(threeNames, 0),
    showNever: false,
    caption:
      "説明のため、候補を3個に絞った `Status` で確認します。型検査は `switch` 文を上から順に解析し、`case` で処理した候補を `status` の型から除外します。",
  },
  {
    code: threeCode,
    lit: [scheduledLine],
    negative: [],
    dimAfter: scheduledLine,
    cards: cardsFor(threeNames, 1),
    showNever: false,
    caption:
      '`status` が `"Scheduled"` なら、ここで `return` します。型検査は、この行より下の `status` の候補を2個と数えます。',
  },
  {
    code: threeCode,
    lit: [checkedInLine],
    negative: [],
    dimAfter: checkedInLine,
    cards: cardsFor(threeNames, 2),
    showNever: false,
    caption:
      '`case "CheckedIn"` も処理しました。型検査は、この行より下の `status` の候補を1個と数えます。',
  },
  {
    code: threeCode,
    lit: [canceledLine],
    negative: [],
    dimAfter: canceledLine,
    cards: cardsFor(threeNames, 3),
    showNever: false,
    caption:
      '`case "Canceled"` も処理しました。型検査は、この行より下の `status` の候補を0個と数えます。箱は空になりました。',
  },
  {
    code: threeCode,
    lit: [defaultLine, restLine],
    negative: [],
    cards: cardsFor(threeNames, 3),
    showNever: true,
    verdict: { kind: "ok", label: "型検査: エラーなし" },
    caption:
      "候補が0個の型を `never` と呼びます。`never` 型の変数には、候補が残っている値を代入できません。ここの `status` は候補が0個であるため、`rest` に代入しても型検査は何も報告しません。",
  },
  {
    code: fourCode,
    lit: [typeLine],
    negative: [restLine],
    cards: cardsWithForgotten(fourNames, 3),
    showNever: false,
    verdict: { kind: "error", label: "型検査のエラー", message: noShowError },
    caption:
      '`Status` に `"NoShow"` を追加し、`case` の実装が漏れました。`default` の `status` には `"NoShow"` が残るため、`never` 型の `rest` に代入できません。型検査は `rest` の行をエラーとして報告します。エラーの文は「`"NoShow"` は `never` 型に代入できません」という意味です。次のページでは、この検証を関数にまとめ、`Appointment` に使います。',
  },
];

export const remainingOf = (frame: Frame): readonly Candidate[] =>
  frame.cards.filter((card) => !card.done).map((card) => card.name);
