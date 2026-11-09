// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { session05ChangeChecks } from "../cancel-workflow/change-checks";
import { session03ChangeChecks } from "../boundary/change-checks";
import { session06ChangeChecks } from "../effects-walkthrough/change-checks";
import { session02ChangeChecks } from "../session-02/change-checks";
import { session01ChangeChecks } from "../states/change-checks";
import { session04ChangeChecks } from "../workflow-errors/change-checks";
import type { ChangeCheckSet, DiffLine } from "./types";

const examplesDir = "../../../../../examples/";

const linesOf = (example: string, name: string): string[] =>
  readFileSync(
    fileURLToPath(new URL(`${examplesDir}${example}/exercises/guard/cases/${name}.ts`, import.meta.url)),
    "utf8",
  ).split("\n");

const missingLines = (wanted: readonly string[], actual: readonly string[]): string[] => {
  const missing: string[] = [];
  let cursor = 0;
  for (const text of wanted) {
    const found = actual.indexOf(text, cursor);
    if (found < 0) missing.push(text);
    else cursor = found + 1;
  }
  return missing;
};

const textsOf = (diff: readonly DiffLine[], kinds: readonly DiffLine["kind"][]) =>
  diff.filter((line) => kinds.includes(line.kind)).map((line) => line.text);

const sets: readonly ChangeCheckSet[] = [
  session01ChangeChecks,
  session02ChangeChecks,
  session03ChangeChecks,
  session04ChangeChecks,
  session05ChangeChecks,
  session06ChangeChecks,
];

describe.each(sets.map((set) => [set.example, set] as const))("%s の change-checks", (example, set) => {
  it.each(set.cases.map((changeCase) => [changeCase.id, changeCase] as const))(
    "%s の差分は、元のコードと変更後のコードの行に対応する",
    (id, changeCase) => {
      const original = linesOf(example, changeCase.baseCase);
      const changed = linesOf(example, id);

      expect(
        missingLines(textsOf(changeCase.diff, ["same", "del"]), original),
        `${id}: same と del の行が ${changeCase.baseCase}.ts に順序どおりには見つからない`,
      ).toEqual([]);
      expect(
        missingLines(textsOf(changeCase.diff, ["same", "add"]), changed),
        `${id}: same と add の行が ${id}.ts に順序どおりには見つからない`,
      ).toEqual([]);
    },
  );

  it.each(set.cases.map((changeCase) => [changeCase.id, changeCase] as const))(
    "%s には、すべての仕組みの結果がある",
    (id, changeCase) => {
      expect(
        set.mechanisms.filter((mechanism) => changeCase.results[mechanism.id] === undefined).map(({ id }) => id),
        `${id}: 結果のない仕組みがある`,
      ).toEqual([]);
    },
  );
});
