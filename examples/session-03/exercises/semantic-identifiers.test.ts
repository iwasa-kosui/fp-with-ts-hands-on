import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AppointmentId } from "../src/domain/ids/appointmentId.js";
import { compileProjectFile, compileTypeFixture } from "./compileTypeFixture.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const testTypesRelativePath = "src/domain/domain.test-types.ts";
const testTypesSource = (): string =>
  readFileSync(path.resolve(directory, "..", testTypesRelativePath), "utf8");

describe("Step 1: 用途の違う識別子は互いに代入できない", () => {
  it("AppointmentIdとVeterinarianIdを取り違えられない", () => {
    expect(
      compileTypeFixture("s3-appointment-id-is-not-veterinarian-id.ts"),
    ).toEqual([]);
  });
});

describe("Step 2: 診察開始まで用途別の識別子を伝える", () => {
  it("予約状態とstartExaminationが用途別の識別子を要求する", () => {
    expect(
      compileTypeFixture("s3-start-examination-requires-typed-ids.ts"),
    ).toEqual([]);
  });
});

describe("Step 3: 取り違えが止まることを型テストで確かめる", () => {
  it("通ってはいけない代入の検査が2件以上あり、そのすべてが実際に止まる", () => {
    expect(
      (testTypesSource().match(/@ts-expect-error/g) ?? []).length,
    ).toBeGreaterThanOrEqual(2);
    expect(compileProjectFile(testTypesRelativePath)).toEqual([]);
  });
});

describe("回帰条件: 識別子は形式検査を通った値からしか作れない", () => {
  it("UUIDでない文字列からAppointmentIdを作れない", () => {
    expect(() => AppointmentId.parse("not-a-uuid")).toThrow();
  });
});
