import { describe, expect, test } from "vitest";
import { Appointment } from "../src/clinic/appointment.js";
import { AppointmentId } from "../src/clinic/appointment-id.js";
import { PetId } from "../src/clinic/pet-id.js";
import { VeterinarianId } from "../src/clinic/veterinarian-id.js";

const NOW = "2026-08-30T06:30:00.000Z";

describe("01 状態を型で閉じる", () => {
  test("診察開始と理由付きキャンセルを表現できる", () => {
    const scheduled = Appointment.book({
      id: AppointmentId.schema.parse("appt_001"),
      petId: PetId.schema.parse("pet_001"),
      scheduledAt: NOW,
    });

    const checkedIn = Appointment.checkIn(scheduled, NOW);
    const inExamination = Appointment.startExamination(
      checkedIn,
      VeterinarianId.schema.parse("vet_001"),
      NOW,
    );
    const canceled = Appointment.cancelWithReason(
      scheduled,
      "owner-request",
      NOW,
      "2026-09-01T06:30:00.000Z",
    );

    expect(inExamination.kind).toBe("InExamination");
    expect(canceled).toMatchObject({
      kind: "Canceled",
      reason: "owner-request",
      followUpRequestedAt: "2026-09-01T06:30:00.000Z",
    });
  });
});
