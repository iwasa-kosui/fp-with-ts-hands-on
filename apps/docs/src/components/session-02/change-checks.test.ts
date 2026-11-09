// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { changeCases, type DiffLine } from "./change-checks";

const casesDir = "../../../../../examples/session-02-solution/exercises/guard/cases/";

const linesOf = (name: string): string[] =>
  readFileSync(fileURLToPath(new URL(`${casesDir}${name}.ts`, import.meta.url)), "utf8").split("\n");

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

describe("change-checks の差分", () => {
  const original = linesOf("G1-assert-never");

  it.each(changeCases.map((changeCase) => [changeCase.id, changeCase] as const))(
    "%s の差分は、元のコードと変更後のコードの行に対応する",
    (id, changeCase) => {
      const changed = linesOf(id);

      expect(
        missingLines(textsOf(changeCase.diff, ["same", "del"]), original),
        `${id}: same と del の行が G1-assert-never.ts に順序どおりには見つからない`,
      ).toEqual([]);
      expect(
        missingLines(textsOf(changeCase.diff, ["same", "add"]), changed),
        `${id}: same と add の行が ${id}.ts に順序どおりには見つからない`,
      ).toEqual([]);
    },
  );
});
