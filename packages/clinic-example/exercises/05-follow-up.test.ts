import { describe, expect, test } from "vitest";
import { Appointment } from "../src/clinic/appointment.js";
import { AppointmentId } from "../src/clinic/appointment-id.js";
import { createInMemoryDomainEventStore } from "../src/clinic/domain-event-store.js";
import { OwnerContact } from "../src/clinic/owner-contact.js";
import { PetId } from "../src/clinic/pet-id.js";
import { collectFollowUpTargets } from "../src/clinic/use-cases.js";
import { VeterinarianId } from "../src/clinic/veterinarian-id.js";

const NOW = "2026-08-30T06:30:00.000Z";

const ownerContact = OwnerContact.schema.parse({
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
});

const paidAppointment = Appointment.recordPayment(
  Appointment.startExamination(
    Appointment.checkIn(
      Appointment.book({
        id: AppointmentId.schema.parse("appt_001"),
        petId: PetId.schema.parse("pet_001"),
        scheduledAt: NOW,
      }),
      NOW,
    ),
    VeterinarianId.schema.parse("vet_001"),
    NOW,
  ),
  { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
  NOW,
);

const canceledAppointment = Appointment.cancelWithReason(
  Appointment.book({
    id: AppointmentId.schema.parse("appt_002"),
    petId: PetId.schema.parse("pet_002"),
    scheduledAt: NOW,
  }),
  "owner-request",
  NOW,
);

describe("05 電話フォロー", () => {
  test("電話フォローが必要な患者だけを抽出し、PII と event を守る", () => {
    const eventStore = createInMemoryDomainEventStore();
    const result = collectFollowUpTargets({
      candidates: [
        {
          appointment: paidAppointment,
          examResult: {
            examId: "exam_001",
            petId: "pet_001",
            collectedAt: NOW,
            needsFollowUp: true,
            items: [{ code: "ALT", value: 42, unit: "U/L" }],
          },
          ownerContact,
        },
        {
          appointment: canceledAppointment,
          examResult: {
            examId: "exam_002",
            petId: "pet_002",
            collectedAt: NOW,
            needsFollowUp: true,
            items: [{ code: "ALT", value: 55, unit: "U/L" }],
          },
          ownerContact,
        },
        {
          appointment: paidAppointment,
          examResult: { examId: "exam_003", petId: "pet_001", collectedAt: NOW },
          ownerContact,
        },
      ],
      eventStore,
    });

    expect(result.kind).toBe("Ok");
    if (result.kind !== "Ok") return;

    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toMatchObject({ appointmentId: paidAppointment.id });
    expect(result.value[0]?.ownerPhone).toBe(ownerContact.ownerPhone);

    const logged = JSON.stringify(result.value);
    expect(logged).toContain("[REDACTED]");
    expect(logged).not.toContain("090-0000-0000");

    expect(eventStore.all()).toEqual([
      expect.objectContaining({
        kind: "FollowUpRequested",
        appointmentId: paidAppointment.id,
      }),
    ]);
  });
});
