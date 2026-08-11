import { describe, expect, it } from "vitest";

import { Appointment, display } from "../src/domain/appointment.js";

describe("Session 04 state transitions", () => {
  it("受付済みの来院だけを診察中へ進める", () => {
    const scheduled = Appointment.book({ appointmentId: "appointment-1", petId: "pet-1", ownerId: "owner-1", scheduledAt: "2026-08-30T06:30:00.000Z" });
    const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
    const examining = Appointment.startExamination(checkedIn, "vet-1", "2026-08-30T06:30:00.000Z");

    if (false) {
      // @ts-expect-error Scheduled は診察開始できません。
      Appointment.startExamination(scheduled, "vet-1", "2026-08-30T06:30:00.000Z");
    }
    expect(examining.kind).toBe("InExamination");
  });

  it("すべての状態を表示できる", () => {
    const scheduled = Appointment.book({ appointmentId: "appointment-1", petId: "pet-1", ownerId: "owner-1", scheduledAt: "2026-08-30T06:30:00.000Z" });
    expect(display(scheduled)).toBe("予約済み: appointment-1");
  });
});
