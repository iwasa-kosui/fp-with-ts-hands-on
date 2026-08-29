import { describe, expect, it } from "vitest";

import { AppointmentId } from "../../src/domain/appointment/index.js";
import { compileTypeFixture } from "./compileTypeFixture.js";

describe("S3 regression: 診察開始の識別子を取り違えない", () => {
  it("AppointmentIdとVeterinarianIdを相互に代入できない", () => {
    expect(
      compileTypeFixture("s3-appointment-id-is-not-veterinarian-id.ts"),
    ).toEqual([]);
  });

  it("予約状態とstartExaminationが用途別の識別子を要求する", () => {
    expect(
      compileTypeFixture("s3-start-examination-requires-typed-ids.ts"),
    ).toEqual([]);
  });

  it("UUIDでない文字列からAppointmentIdを作れない", () => {
    expect(() => AppointmentId.parse("not-a-uuid")).toThrow();
  });
});
