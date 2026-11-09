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
  "01-state-transitions": { rule: "会計済みの予約は、診察に戻せない", incident: "課題1" },
  "02-adt-and-exhaustiveness": { rule: "予約の状態を増やしたら、すべての表示を対応させる" },
  "03-boundaries-and-pii": {
    rule: "外から届く値は確かめてから使う。調査に要らない連絡先は監査記録に残さない",
    incident: "課題2",
  },
  "04-workflow-errors": { rule: "「予約が見つからない」と「今の状態では操作できない」を取り違えない" },
  "05-business-events-and-workflows": { rule: "工程の途中で失敗したら、その先の工程へ進まない" },
  "06-effects-and-consistency": { rule: "予約の変更と監査記録は、両方残すか、どちらも残さない" },
  final: { rule: "ここまでの決まりを、1つのシステムの中で通してたどる" },
};
