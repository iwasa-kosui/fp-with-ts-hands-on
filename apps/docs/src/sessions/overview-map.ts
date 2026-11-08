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
  summary: string;
  fills: readonly StageId[];
}>;

export type SessionSlug = (typeof sessionNavigationItems)[number]["slug"];

export const sessionOverviews: Readonly<Record<SessionSlug, SessionOverview>> = {
  "00-system-handover": {
    summary: "業務と、SQLite に残る記録と、起きている事故2件を確かめます。図はまだ埋まりません。",
    fills: [],
  },
  "01-state-transitions": {
    summary: "予約の状態と、許される遷移を型で表します。",
    fills: ["decide"],
  },
  "02-adt-and-exhaustiveness": {
    summary: "状態を足したときの分岐漏れを、型検査で見つけます。S01 の状態の型を使います。",
    fills: ["decide"],
  },
  "03-boundaries-and-pii": {
    summary: "HTTP から届く値を入口で検査し、型の付いた入力に変えます。",
    fills: ["entry"],
  },
  "04-workflow-errors": {
    summary: "失敗を例外で投げず、Result の値として返します。例外と Result の使い分けも決めます。",
    fills: ["failure"],
  },
  "05-business-events-and-workflows": {
    summary: "予約キャンセルを例に、工程を Result でつなぎ、読み書きを道の両端に置く設計を読みます。S04 の Result と andThen を使います。",
    fills: ["read", "failure"],
  },
  "06-effects-and-consistency": {
    summary: "時刻・ID・保存を外から渡し、予約の状態と監査記録を1回で保存します。S05 の道の形を使います。",
    fills: ["save"],
  },
  final: {
    summary: "参照実装で、埋まった図の全体をたどります。",
    fills: stages.map(({ id }) => id),
  },
};
