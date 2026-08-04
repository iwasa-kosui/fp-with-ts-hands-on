import { beforeEach, describe, expect, test } from "vitest";
import { bookAppointment, resetLegacyStore, updateStatus } from "../src/legacy/appointment.js";

const sampleInput = {
  id: "appt_001", petId: "pet_001", petName: "Mugi", ownerId: "owner_001",
  ownerName: "Owner A", ownerEmail: "owner@example.test", ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z", reason: "skin check",
};

describe("setup", () => {
  beforeEach(() => resetLegacyStore());
  test("予約から会計までの通常フローは動く", () => {
    const created = bookAppointment(sampleInput);
    updateStatus(created.id, "checked-in");
    updateStatus(created.id, "in-examination", { veterinarianId: "vet_001" });
    const paid = updateStatus(created.id, "paid", { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 });
    expect(paid.status).toBe("paid");
    expect(paid.amount).toBe(4800);
  });
});
