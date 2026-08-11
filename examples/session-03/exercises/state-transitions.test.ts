import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";

it("受付済みの来院だけを診察中へ進められる", () => {
  const scheduled = Appointment.book({
    appointmentId: "appointment-1",
    petId: "pet-1",
    ownerId: "owner-1",
    scheduledAt: "2026-08-30T06:30:00.000Z",
  });
  const checkedIn = Appointment.checkIn(scheduled, "2026-08-30T06:20:00.000Z");
  const examining = Appointment.startExamination(
    checkedIn,
    "vet-1",
    "2026-08-30T06:30:00.000Z",
  );

  expect(examining.kind).toBe("InExamination");
});
