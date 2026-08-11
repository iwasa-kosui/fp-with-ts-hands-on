import { describe, expect, it } from "vitest";

import { Appointment, type InExamination } from "../src/domain/appointment.js";

describe("Session 03 state vocabulary", () => {
  it("状態ごとに必要な情報を明示する", () => {
    const scheduled = Appointment.book({
      appointmentId: "appointment-1",
      petId: "pet-1",
      ownerId: "owner-1",
      scheduledAt: "2026-08-30T06:30:00.000Z",
    });
    const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
    const examining: InExamination = {
      ...checkedIn,
      kind: "InExamination",
      veterinarianId: "vet-1",
      examinationStartedAt: "2026-08-30T06:30:00.000Z",
    };

    expect(examining).toMatchObject({
      kind: "InExamination",
      veterinarianId: "vet-1",
    });
  });
});
