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

  test.each([
    "0000-01-01T00:00:00+14:00",
    "0000-01-01T00:00:00+1400",
    "9999-12-31T23:59:59-14:00",
    "9999-12-31T23:59:59-1400",
  ])("rejects an offset instant outside the four-digit UTC year range: %s", (value) => {
    expect(Timestamp.schema.safeParse(value).success).toBe(false);
  });

  test.each([
    ["0000-01-01T14:00:00+14:00", "0000-01-01T00:00:00.000Z"],
    ["0000-01-01T14:00:00+1400", "0000-01-01T00:00:00.000Z"],
    ["9999-12-31T09:59:59-14:00", "9999-12-31T23:59:59.000Z"],
    ["9999-12-31T09:59:59.999-1400", "9999-12-31T23:59:59.999Z"],
    ["2000-02-29T00:00:00.1Z", "2000-02-29T00:00:00.100Z"],
  ])("canonicalizes a supported boundary instant: %s", (value, expected) => {
    const parsed = Timestamp.canonicalSchema.safeParse(value);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const timestamp: Timestamp = parsed.data;
    expect(timestamp).toBe(expected);
  });

  test.each([
    undefined,
    null,
    {},
    "",
    "not-a-timestamp",
    "0000-01-01T00:00:00+14:00",
    "9999-12-31T23:59:59-14:00",
  ])("canonical safeParse never throws and returns failure for %j", (value) => {
    expect(() => Timestamp.canonicalSchema.safeParse(value)).not.toThrow();
    expect(Timestamp.canonicalSchema.safeParse(value).success).toBe(false);
  });
});
