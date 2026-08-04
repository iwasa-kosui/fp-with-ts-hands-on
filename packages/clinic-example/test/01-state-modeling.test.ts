import { describe, expect, test } from "vitest";
import { Appointment } from "../src/clinic/appointment.js";
import { AppointmentId } from "../src/clinic/appointment-id.js";
import { PetId } from "../src/clinic/pet-id.js";
import { VeterinarianId } from "../src/clinic/veterinarian-id.js";

const NOW = "2026-08-30T06:30:00.000Z";
const appointmentId = AppointmentId.schema.parse("appt_001");
const petId = PetId.schema.parse("pet_001");
const veterinarianId = VeterinarianId.schema.parse("vet_001");
const scheduled = Appointment.book({ id: appointmentId, petId, scheduledAt: NOW });
const checkedIn = Appointment.checkIn(scheduled, NOW);
const inExamination = Appointment.startExamination(checkedIn, veterinarianId, NOW);

describe("01 状態モデリング", () => {
  test("予約は状態に必要な情報とともに遷移する", () => {
    const paid = Appointment.recordPayment(inExamination, { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 }, NOW);
    expect(checkedIn.kind).toBe("CheckedIn");
    expect(inExamination.kind).toBe("InExamination");
    expect(paid.kind).toBe("Paid");
    expect(Appointment.isTerminal(paid)).toBe(true);
  });

  test("キャンセルには理由と任意の再診希望日を残せる", () => {
    const canceled = Appointment.cancelWithReason(scheduled, "owner-request", NOW, "2026-09-01T06:30:00.000Z");
    expect(canceled).toMatchObject({ kind: "Canceled", reason: "owner-request", followUpRequestedAt: "2026-09-01T06:30:00.000Z" });
    expect(Appointment.isTerminal(canceled)).toBe(true);
  });
});

const paid = Appointment.recordPayment(inExamination, { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 }, NOW);
// @ts-expect-error Paid cannot start examination again.
Appointment.startExamination(paid, veterinarianId, NOW);
// @ts-expect-error Paid cannot be canceled.
Appointment.cancelWithReason(paid, "owner-request", NOW);
// @ts-expect-error cancel reason must be a known domain value.
Appointment.cancelWithReason(scheduled, "なんとなく", NOW);
