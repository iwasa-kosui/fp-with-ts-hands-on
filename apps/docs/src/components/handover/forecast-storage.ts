export const incidents = [
  { id: "double-billing", title: "課題1 二重請求" },
  { id: "pii-audit", title: "課題2 連絡先が読める監査記録" },
] as const;

export const stages = [
  { value: "entry", label: "入口" },
  { value: "read", label: "読み取り" },
  { value: "decide", label: "業務の判断" },
  { value: "save", label: "保存" },
  { value: "failure", label: "失敗の返し方" },
] as const;

export const mechanisms = [
  { value: "write", label: "書いた時点で気づく", text: "型検査（値の種類の食い違いを実行の前に調べる仕組み）や Linter（書き方の誤りを調べる道具）が、書いているときに誤りを報告します。" },
  { value: "test", label: "テストで気づく", text: "テスト（期待どおりに動くかを確かめるコード）を実行したときに、誤りが報告されます。" },
  { value: "runtime", label: "動かしているときに気づく", text: "サーバーが処理の途中で値を確かめ、その操作を受け付けません。" },
  { value: "human", label: "人が気づく", text: "レビューや運用の確認で、担当者が見つけます。" },
] as const;

export const STORAGE_KEY = "fp-with-ts:forecast:session-00";

export type Choice = { stage?: string; mechanism?: string };
export type Saved = { version: 1; incidents: Record<string, Choice> };

const allowed: Record<keyof Choice, readonly string[]> = {
  stage: stages.map(({ value }) => value),
  mechanism: mechanisms.map(({ value }) => value),
};

export const load = (): Saved => {
  const empty: Saved = { version: 1, incidents: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return empty;
    const saved = (parsed as { incidents?: unknown }).incidents;
    if (typeof saved !== "object" || saved === null) return empty;
    const result: Saved = { version: 1, incidents: {} };
    for (const { id } of incidents) {
      const entry = (saved as Record<string, unknown>)[id];
      if (typeof entry !== "object" || entry === null) continue;
      const choice: Choice = {};
      for (const field of ["stage", "mechanism"] as const) {
        const value = (entry as Record<string, unknown>)[field];
        if (typeof value === "string" && allowed[field].includes(value)) choice[field] = value;
      }
      result.incidents[id] = choice;
    }
    return result;
  } catch {
    return empty;
  }
};

export const save = (saved: Saved): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    return;
  }
};
