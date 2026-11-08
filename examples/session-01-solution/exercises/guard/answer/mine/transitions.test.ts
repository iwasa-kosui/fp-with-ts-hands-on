import { describe, expect, it } from "vitest";

import { cancel, startExamination } from "../../subjects/transitions.js";
import { checkedIn, scheduled } from "./states.js";

const veterinarianId = "55555555-5555-4555-8555-555555555555";
const startedAt = "2026-08-30T06:25:00.000Z";
const canceledAt = "2026-08-30T05:55:00.000Z";

describe("遷移関数", () => {
  it("診察開始は、渡した獣医師と時刻を入れ、来院の情報を引き継ぐ", () => {
    expect(startExamination(checkedIn, veterinarianId, startedAt)).toMatchObject({
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: startedAt,
      checkedInAt: checkedIn.checkedInAt,
      reason: checkedIn.reason,
    });
  });

  it("キャンセルは、渡した理由と時刻を入れ、予約の情報を引き継ぐ", () => {
    expect(cancel(scheduled, "schedule conflict", canceledAt)).toMatchObject({
      kind: "Canceled",
      reason: "schedule conflict",
      canceledAt,
      appointmentId: scheduled.appointmentId,
      scheduledAt: scheduled.scheduledAt,
    });
  });
});
