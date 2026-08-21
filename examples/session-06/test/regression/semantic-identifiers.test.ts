import { describe, expect, it } from "vitest";

import { compileTypeFixture } from "./compileTypeFixture.js";
import { PetId } from "../../src/domain/ids/petId.js";

describe("S3 regression: 用途の違う識別子を取り違えない", () => {
  it("OwnerId を PetId の位置へ渡せない", () => {
    expect(compileTypeFixture("s3-owner-id-is-not-pet-id.ts")).toEqual([]);
  });

  it("予約の状態と遷移が用途別の識別子を要求する", () => {
    expect(compileTypeFixture("s3-appointment-requires-typed-ids.ts")).toEqual([]);
  });

  it("UUID でない文字列から PetId を作れない", () => {
    expect(() => PetId.parse("not-a-uuid")).toThrow();
  });
});
