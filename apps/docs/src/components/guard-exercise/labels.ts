import type {
  GuardCell,
  GuardMechanism,
  GuardResult,
  GuardRow,
  GuardVerdict,
} from "../../code-explorer/guard-result";
import type {
  GuardBehavior,
  GuardCaseInfo,
} from "../../code-explorer/guard-paths";

export const mechanismHeaders: Readonly<Record<GuardMechanism, string>> = {
  types: "型",
  lint: "Linter",
  tests: "テスト",
};

export const tableTermsSummary = "表の言葉";

export const tableTermsText =
  "「誤検知」は、正しいコードを誤った変更として検出することで、Linter のルールかテストの対象が広すぎると発生します。「対象外」は、その誤った変更では数えない仕組みです。「未検出」は、誤った変更の行について、型、Linter、テストの各列ではその列の仕組みがまだ検出していないことを、「結果」の列では数える対象の仕組みのどれも検出しなかったことを表します。「なし」は正しいコードの行で、その列に誤検知がないこと（良い状態）を表します。";

export const cellText = (cell: GuardCell, kind: GuardRow["kind"]): string =>
  cell.state === "hit"
    ? `検出 ${cell.count}件`
    : cell.state === "na"
      ? "対象外"
      : cell.state === "error"
        ? "エラー"
        : kind === "bad"
          ? "未検出"
          : "なし";

export const verdictText = (verdict: GuardVerdict | undefined): string =>
  verdict === "detected"
    ? "検出"
    : verdict === "slipped"
      ? "未検出"
      : verdict === "unchanged"
        ? "未変更"
        : verdict === "falsePositive"
          ? "誤検知あり"
          : verdict === "noFalsePositive"
            ? "誤検知なし"
            : "未確認";

export type DisplayRow = Readonly<{
  id: string;
  kind: "bad" | "good";
  title: string;
  hint: string;
  cells: GuardRow["cells"] | undefined;
  verdict: GuardVerdict | undefined;
  behavior?: GuardBehavior;
}>;

const behaviorOf = (
  cases: readonly GuardCaseInfo[],
  id: string,
): Pick<DisplayRow, "behavior"> => {
  const behavior = cases.find((item) => item.id === id)?.behavior;
  return behavior === undefined ? {} : { behavior };
};

export const displayRowsFor = (
  result: GuardResult | undefined,
  cases: readonly GuardCaseInfo[],
): readonly DisplayRow[] =>
  result !== undefined
    ? result.rows.map(({ id, kind, title, hint, cells, verdict }) => ({
        id,
        kind,
        title,
        hint,
        cells,
        verdict,
        ...behaviorOf(cases, id),
      }))
    : cases
        .filter(({ stage }) => stage <= 1)
        .map(({ id, kind, title, behavior }) => ({
          id,
          kind,
          title,
          hint: "",
          cells: undefined,
          verdict: undefined,
          ...(behavior === undefined ? {} : { behavior }),
        }));

export const headlineFor = (result: GuardResult): string => {
  const required = result.rows.filter(
    (row) => row.kind === "bad" && row.required,
  );
  const detected = required.filter((row) => row.verdict === "detected");
  return result.passed
    ? "合格です"
    : `まだ合格していません（必須の誤った変更 ${required.length} 件のうち ${detected.length} 件を検出）`;
};

export const secondsText = (seconds: number): string => `${seconds.toFixed(1)}s`;
