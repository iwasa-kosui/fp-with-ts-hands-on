// results は exercise-guard の模範解答の仕組みを各ケースに実行した実際の出力です。
export type DiffLine = Readonly<{ kind: "same" | "del" | "add" | "skip"; text: string }>;
export type Mechanism = "types" | "lint" | "tests";
export type Outcome = Readonly<{ found: boolean; output: string; notRun?: boolean; setting?: string }>;
export type ChangeCase = Readonly<{
  id: string;
  kind: "bad" | "good";
  label: string;
  baseCase: string;
  target: string;
  diff: readonly DiffLine[];
  results: Partial<Record<Mechanism, Outcome>>;
  why: string;
}>;
export type MechanismInfo = Readonly<{ id: Mechanism; name: string; detail: string; code: string }>;
export type ChangeCheckSet = Readonly<{
  example: string;
  ariaLabel: string;
  mechanisms: readonly MechanismInfo[];
  cases: readonly ChangeCase[];
}>;
