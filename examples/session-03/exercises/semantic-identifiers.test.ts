import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { compileProjectFile, compileTypeFixture } from "./compileTypeFixture.js";
import { PetId } from "../src/domain/ids/petId.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const testTypesRelativePath = "src/domain/domain.test-types.ts";
const testTypesSource = (): string =>
  readFileSync(path.resolve(directory, "..", testTypesRelativePath), "utf8");

describe("Step 1: 用途の違う識別子は互いに代入できない", () => {
  it("OwnerId を PetId の位置へ渡せない", () => {
    expect(compileTypeFixture("s3-owner-id-is-not-pet-id.ts")).toEqual([]);
  });
});

describe("Step 2: 予約はどの状態でも用途別の識別子を持つ", () => {
  it("飼い主の識別子でペットの識別子を置き換えられない", () => {
    expect(compileTypeFixture("s3-appointment-requires-typed-ids.ts")).toEqual([]);
  });
});

describe("Step 3: 取り違えが止まることを型テストで確かめる", () => {
  it("通ってはいけない代入の検査が2件以上あり、そのすべてが実際に止まる", () => {
    expect((testTypesSource().match(/@ts-expect-error/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(compileProjectFile(testTypesRelativePath)).toEqual([]);
  });
});

describe("回帰条件: 識別子は形式検査を通った値からしか作れない", () => {
  it("UUID でない文字列から PetId を作れない", () => {
    expect(() => PetId.parse("not-a-uuid")).toThrow();
  });
});
