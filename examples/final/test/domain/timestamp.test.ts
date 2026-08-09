import { describe, expect, test } from "vitest";

import { Timestamp } from "../../src/domain/aggregate/timestamp.js";

describe("Timestamp", () => {
  test.each([
    "2026-08-10T10:00:00.1Z",
    "2026-08-10T10:00:00.12+09:30",
    "2026-08-10T10:00:00.123-1400",
  ])("accepts millisecond-or-coarser precision: %s", (value) => {
    expect(Timestamp.schema.safeParse(value).success).toBe(true);
  });

  test("rejects sub-millisecond precision so every layer shares one instant", () => {
    expect(Timestamp.schema.safeParse("2026-08-10T10:00:00.0005Z").success)
      .toBe(false);
  });
});
