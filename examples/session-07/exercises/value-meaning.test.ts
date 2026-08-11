import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";

it("ペット ID を飼い主 ID として扱えない", () => {
  const petId = "22222222-2222-4222-8222-222222222222";
  const scheduled = Appointment.book({
    appointmentId: "11111111-1111-4111-8111-111111111111",
    petId,
    ownerId: petId,
    scheduledAt: "2026-08-30T06:00:00.000Z",
  });

  expect(scheduled.ownerId).not.toBe(petId);
});
