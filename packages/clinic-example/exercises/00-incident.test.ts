import { beforeEach, describe, expect, test } from "vitest";
import { bookAppointment, resetLegacyStore, updateStatus } from "../src/legacy/appointment.js";

const sampleInput = {
  id: "appt_001", petId: "pet_001", petName: "Mugi", ownerId: "owner_001",
  ownerName: "Owner A", ownerEmail: "owner@example.test", ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z", reason: "skin check",
};

describe("00 事故を起こす", () => {
  beforeEach(() => resetLegacyStore());
  test("会計済みの来院は診察中に戻せないはず", () => {
    const created = bookAppointment(sampleInput);
    updateStatus(created.id, "checked-in");
    updateStatus(created.id, "in-examination", { veterinarianId: "vet_001" });
    updateStatus(created.id, "paid", { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 });
    const reverted = updateStatus(created.id, "in-examination", { veterinarianId: "vet_002" });
    expect(reverted.status).toBe("paid");
  });
});
