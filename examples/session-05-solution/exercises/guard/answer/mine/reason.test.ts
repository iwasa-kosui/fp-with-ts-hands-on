import { describe, expect, it } from "vitest";

import { CancellationReason } from "../../subjects/reason.js";

describe("CancellationReason.parse", () => {
  it("空の文字列は Err", () => {
    expect(CancellationReason.parse("").isErr()).toBe(true);
  });

  it("空白だけの文字列は Err", () => {
    expect(CancellationReason.parse("   ").isErr()).toBe(true);
  });

  it("理由のある文字列は Ok", () => {
    expect(CancellationReason.parse("予定が変わったため").isOk()).toBe(true);
  });
});
