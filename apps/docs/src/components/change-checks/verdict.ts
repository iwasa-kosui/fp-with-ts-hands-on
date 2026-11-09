import type { ChangeCase, Mechanism, Outcome } from "./types";

export const outcomeOf = (changeCase: ChangeCase, mechanism: Mechanism): Outcome => {
  const outcome = changeCase.results[mechanism];
  if (!outcome) throw new Error(`${changeCase.id}: ${mechanism} の結果がありません`);
  return outcome;
};

export const verdictOf = (
  changeCase: ChangeCase,
  mechanism: Mechanism,
): Readonly<{ tone: "positive" | "negative" | "neutral"; text: string }> => {
  const outcome = outcomeOf(changeCase, mechanism);
  if (outcome.notRun) return { tone: "neutral", text: "－ 対象外" };
  if (outcome.found) return { tone: "positive", text: "✓ 検出" };
  return changeCase.kind === "bad"
    ? { tone: "negative", text: "▲ 未検出" }
    : { tone: "positive", text: "✓ 誤検知なし" };
};
