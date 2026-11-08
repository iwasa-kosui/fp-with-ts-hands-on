import type { GuardResult } from "./guard-result";

export const cell = (state: "hit" | "none" | "error" | "na", count = 0) => ({
  state,
  count,
});

export const sampleGuardResult: GuardResult = {
  version: 1,
  passed: false,
  rows: [
    {
      id: "B1-any-parser",
      kind: "bad",
      title: "parse が any を受け取る",
      stage: 1,
      required: true,
      allow: ["lint", "tests"],
      hint: "any を禁じる規則で検出します。",
      cells: {
        types: cell("na"),
        lint: cell("none"),
        tests: cell("none"),
      },
      verdict: "slipped",
      detections: { types: [], lint: [], tests: [] },
      builtinTypes: [],
      collectionErrors: [],
    },
    {
      id: "G1-solution",
      kind: "good",
      title: "正しい parse",
      stage: 1,
      required: false,
      allow: [],
      hint: "",
      cells: {
        types: cell("none"),
        lint: cell("none"),
        tests: cell("none"),
      },
      verdict: "noFalsePositive",
      detections: { types: [], lint: [], tests: [] },
      builtinTypes: [],
      collectionErrors: [],
    },
  ],
  hiddenCount: 1,
  problems: [],
  notes: [],
  next: ["まだ仕組みがありません。"],
  durations: { types: 0.7, lint: 1.1, tests: 3.4, total: 5.1 },
};
