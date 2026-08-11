import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";

it("予約済みまたは受付済みの来院だけをキャンセルできる", () => {
  const scheduled = Appointment.book({
    appointmentId: "appointment-1",
    petId: "pet-1",
    ownerId: "owner-1",
    scheduledAt: "2026-08-30T06:30:00.000Z",
  });
  const canceled = Appointment.cancel(scheduled, {
    reason: "owner-request",
    now: "2026-08-29T10:00:00.000Z",
  });

  expect(canceled.kind).toBe("Canceled");
});
