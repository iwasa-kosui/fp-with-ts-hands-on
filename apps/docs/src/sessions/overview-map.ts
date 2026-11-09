import type { sessionNavigationItems } from "./navigation";

export const stages = [
  { id: "entry", label: "入口（届いた値の検査）" },
  { id: "read", label: "読み取り" },
  { id: "decide", label: "業務の判断" },
  { id: "save", label: "保存" },
  { id: "failure", label: "失敗の返し方" },
] as const;

export type StageId = (typeof stages)[number]["id"];

export type SessionOverview = Readonly<{
  rule: string;
  incident?: "課題1" | "課題2";
}>;

export type SessionSlug = (typeof sessionNavigationItems)[number]["slug"];

export const sessionOverviews: Readonly<Record<Exclude<SessionSlug, "00-system-handover">, SessionOverview>> = {
  "01-state-transitions": { rule: "会計済みの予約は、診察中の状態へ戻さない", incident: "課題1" },
  "02-adt-and-exhaustiveness": { rule: "予約の状態を追加したら、すべての表示を対応させる" },
  "03-boundaries-and-pii": {
    rule: "外部から受け取る値は検証してから使う。調査に不要な個人情報は監査記録に出力しない",
    incident: "課題2",
  },
  "04-workflow-errors": { rule: "「予約が見つからない」と「今の状態では操作できない」を区別する" },
  "05-business-events-and-workflows": { rule: "確認に1つでも失敗したキャンセルは記録しない" },
  "06-effects-and-consistency": { rule: "予約の変更と監査記録は、両方残すか、どちらも残さない" },
  final: { rule: "実装した業務ルールを、1つのシステムの処理全体で確認する" },
};
