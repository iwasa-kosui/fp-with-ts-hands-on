import { beforeEach, describe, expect, it } from "vitest";

import {
  bookAppointment,
  resetLegacyStore,
  updateStatus,
  type BookAppointmentInput,
} from "../src/appointment.js";

const appointmentInput = {
  id: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  petName: "Mugi",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
} as const satisfies BookAppointmentInput;

describe("Session 00 setup", () => {
  beforeEach(resetLegacyStore);

  it("予約から会計までの通常フローは動く", () => {
    const scheduled = bookAppointment(appointmentInput);
    const checkedIn = updateStatus(scheduled.id, "checked-in");
    const examining = updateStatus(checkedIn.id, "in-examination", {
      veterinarianId: "44444444-4444-4444-8444-444444444444",
    });
    const paid = updateStatus(examining.id, "paid", {
      diagnosis: "dermatitis",
      treatment: "ointment",
      amount: 4800,
    });

    expect(paid.status).toBe("paid");
    expect(paid.amount).toBe(4800);
  });
});
