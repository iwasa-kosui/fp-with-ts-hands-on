import { describe, expect, it } from "vitest";

import { toStatusLabel } from "../src/domain/appointment/statusLabel.js";

describe("Session 01 setup", () => {
  it("予約済みの来院を表示できる", () => {
    expect(toStatusLabel({ kind: "Scheduled" })).toBe("予約済み");
  });
});
