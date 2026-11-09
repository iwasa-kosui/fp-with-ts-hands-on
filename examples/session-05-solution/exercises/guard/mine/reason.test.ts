import { describe, expect, it } from "vitest";

import { CancellationReason } from "../subjects/reason.js";

describe("CancellationReason.parse", () => {
  it("空の文字列を渡したとき", () => {
    const result = CancellationReason.parse("");
    // ここに空の理由で Err になることを書きます
  });
});
