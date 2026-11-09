export type GuardMechanism = "types" | "lint" | "tests";

export const guardMechanisms = [
  "types",
  "lint",
  "tests",
] as const satisfies readonly GuardMechanism[];

export type GuardDetection = Readonly<{
  mechanism: GuardMechanism;
  file: string;
  line: number | null;
  label: string;
  message: string;
}>;

export type GuardCellState = "hit" | "none" | "error" | "na";

export type GuardCell = Readonly<{ state: GuardCellState; count: number }>;

export type GuardVerdict =
  | "detected"
  | "slipped"
  | "unchanged"
  | "falsePositive"
  | "noFalsePositive";

export type GuardRow = Readonly<{
  id: string;
  kind: "bad" | "good";
  title: string;
  stage: number;
  required: boolean;
  allow: readonly GuardMechanism[];
  hint: string;
  cells: Readonly<Record<GuardMechanism, GuardCell>>;
  verdict: GuardVerdict;
  detections: Readonly<Record<GuardMechanism, readonly GuardDetection[]>>;
  builtinTypes: readonly GuardDetection[];
  collectionErrors: readonly GuardDetection[];
}>;

export type GuardDurations = Readonly<{
  types: number;
  lint: number;
  tests: number;
  total: number;
}>;

export type GuardResult = Readonly<{
  version: 1;
  passed: boolean;
  rows: readonly GuardRow[];
  hiddenCount: number;
  problems: readonly string[];
  notes: readonly string[];
  next: readonly string[];
  durations: GuardDurations;
  testsTimedOut?: boolean;
  testCaseTimedOut?: boolean;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const cellStates: readonly unknown[] = ["hit", "none", "error", "na"];
const verdicts: readonly unknown[] = [
  "detected",
  "slipped",
  "unchanged",
  "falsePositive",
  "noFalsePositive",
];

const isCell = (value: unknown): value is GuardCell =>
  isRecord(value) &&
  cellStates.includes(value.state) &&
  typeof value.count === "number";

const isDetectionList = (value: unknown): value is readonly GuardDetection[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isRecord(item) &&
      typeof item.file === "string" &&
      typeof item.label === "string",
  );

const hasEveryMechanism = (
  value: unknown,
  check: (item: unknown) => boolean,
): boolean =>
  isRecord(value) && guardMechanisms.every((mechanism) => check(value[mechanism]));

const isRow = (value: unknown): value is GuardRow =>
  isRecord(value) &&
  typeof value.id === "string" &&
  (value.kind === "bad" || value.kind === "good") &&
  typeof value.title === "string" &&
  typeof value.hint === "string" &&
  verdicts.includes(value.verdict) &&
  hasEveryMechanism(value.cells, isCell) &&
  hasEveryMechanism(value.detections, isDetectionList);

export const isGuardResult = (value: unknown): value is GuardResult =>
  isRecord(value) &&
  value.version === 1 &&
  typeof value.passed === "boolean" &&
  Array.isArray(value.rows) &&
  value.rows.every(isRow) &&
  isStringList(value.problems) &&
  isStringList(value.notes) &&
  isStringList(value.next) &&
  isRecord(value.durations);

export const parseGuardResult = (text: string): GuardResult | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);
    return isGuardResult(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};
