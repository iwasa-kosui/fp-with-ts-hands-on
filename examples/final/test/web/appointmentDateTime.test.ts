import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import {
  toAppointmentTimestamp,
  toLocalAppointmentDateTime,
} from "../../src/adaptor/primary/web/components/appointmentDateTime.js";

const moduleUrl = new URL(
  "../../src/adaptor/primary/web/components/appointmentDateTime.ts",
  import.meta.url,
).href;

const convertInTimeZone = (timeZone: string) => {
  const program = `
    const formatter = await import(${JSON.stringify(moduleUrl)});
    process.stdout.write(JSON.stringify({
      timestamp: formatter.toAppointmentTimestamp("2026-08-10T12:34"),
      displayed: formatter.toLocalAppointmentDateTime("2026-08-10T03:34:00.000Z"),
    }));
  `;
  return JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", program],
    {
      encoding: "utf8",
      env: { ...process.env, TZ: timeZone },
    },
  )) as Readonly<{ timestamp: string | null; displayed: string | null }>;
};

describe("appointment datetime-local boundary", () => {
  test.each(["UTC", "America/New_York"])(
    "uses the fixed Asia/Tokyo wall clock in an isolated %s process",
    (timeZone) => {
      expect(convertInTimeZone(timeZone)).toEqual({
        timestamp: "2026-08-10T03:34:00.000Z",
        displayed: "2026-08-10T12:34",
      });
    },
  );

  test.each([
    "2026-02-30T12:34",
    "2026-08-10T24:00",
    "2026-08-10T12:60",
    "not-a-local-datetime",
  ])("rejects the impossible local calendar time %s", (value) => {
    expect(toAppointmentTimestamp(value)).toBeNull();
  });

  test("keeps an empty form value empty and rejects an invalid stored timestamp", () => {
    expect(toAppointmentTimestamp("")).toBe("");
    expect(toLocalAppointmentDateTime("not-a-timestamp")).toBeNull();
  });
});
