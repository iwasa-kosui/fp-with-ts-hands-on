import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";

it("外部からの診察開始入力で不正な UUID を拒否する", () => {
  const scheduled = Appointment.book({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    petId: "22222222-2222-4222-8222-222222222222",
    ownerId: "33333333-3333-4333-8333-333333333333",
    scheduledAt: "2026-08-30T06:00:00.000Z",
  });
  const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
  const examining = Appointment.startExamination(
    checkedIn,
    "not-a-uuid",
    "2026-08-30T06:30:00.000Z",
  );

  expect(examining.veterinarianId).not.toBe("not-a-uuid");
});
