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
  fixes: readonly number[];
  advancedFixes?: readonly number[];
}>;

export type SessionSlug = (typeof sessionNavigationItems)[number]["slug"];

export const sessionOverviews: Readonly<Record<SessionSlug, SessionOverview>> = {
  "00-system-handover": {
    summary: "業務と、データベースに残る記録と、起きている事故2件を確かめます。ここではまだ直しません。",
    fills: [],
    fixes: [],
  },
  "01-state-transitions": {
    summary: "予約の状態と、許される状態の変化をコードに書き表します。",
    fills: ["decide"],
    fixes: [1, 2],
  },
  "02-adt-and-exhaustiveness": {
    summary: "状態を足したときの分岐の書き忘れを、型検査で見つけます。",
    fills: ["decide"],
    fixes: [],
  },
  "03-boundaries-and-pii": {
    summary: "サーバーに届く値を入口で検査します。監査記録から連絡先を除きます。",
    fills: ["entry"],
    fixes: [3, 4, 5],
    advancedFixes: [4],
  },
  "04-workflow-errors": {
    summary: "失敗の理由を、取り違えずに画面まで返します。",
    fills: ["failure"],
    fixes: [6],
  },
  "05-business-events-and-workflows": {
    summary: "予約キャンセルを例に、工程のつなぎ方を読みます。業務のコードは編集せず、仕組みを選びます。",
    fills: ["read", "failure"],
    fixes: [],
  },
  "06-effects-and-consistency": {
    summary: "時刻と ID と保存を外から渡し、予約の状態と監査記録を1回で保存します。",
    fills: ["save"],
    fixes: [7, 8],
  },
  final: {
    summary: "参照実装で、埋まった図の全体をたどります。",
    fills: [],
    fixes: [],
  },
};
