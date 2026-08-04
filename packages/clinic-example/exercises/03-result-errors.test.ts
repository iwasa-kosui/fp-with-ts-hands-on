import { describe, expect, test } from "vitest";
import { Appointment } from "../src/clinic/appointment.js";
import { AppointmentId } from "../src/clinic/appointment-id.js";
import { createInMemoryAppointmentRepository } from "../src/clinic/appointment-repository.js";
import { createInMemoryDomainEventStore } from "../src/clinic/domain-event-store.js";
import { PetId } from "../src/clinic/pet-id.js";
import { startExaminationUseCase } from "../src/clinic/use-cases.js";

const NOW = "2026-08-30T06:30:00.000Z";

describe("03 失敗理由と変更記録を返す", () => {
  test("成功した診察開始だけを domain event に残す", () => {
    const scheduled = Appointment.book({
      id: AppointmentId.schema.parse("appt_001"),
      petId: PetId.schema.parse("pet_001"),
      scheduledAt: NOW,
    });
    const checkedIn = Appointment.checkIn(scheduled, NOW);
    const repo = createInMemoryAppointmentRepository([checkedIn]);
    const eventStore = createInMemoryDomainEventStore();

    const result = startExaminationUseCase(repo, {
      appointmentId: "appt_001",
      veterinarianId: "vet_001",
      eventId: "event_001",
      occurredAt: NOW,
      eventStore,
    });

    expect(result.kind).toBe("Ok");
    expect(eventStore.all()).toEqual([
      expect.objectContaining({ kind: "ExaminationStarted" }),
    ]);
  });
});
