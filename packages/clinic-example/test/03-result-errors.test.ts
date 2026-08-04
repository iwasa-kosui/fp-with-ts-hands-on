import { describe, expect, test } from "vitest";
import { Appointment } from "../src/clinic/appointment.js";
import { AppointmentId } from "../src/clinic/appointment-id.js";
import { createInMemoryAppointmentRepository } from "../src/clinic/appointment-repository.js";
import { createInMemoryDomainEventStore } from "../src/clinic/domain-event-store.js";
import { PetId } from "../src/clinic/pet-id.js";
import { startExaminationUseCase } from "../src/clinic/use-cases.js";

const NOW = "2026-08-30T06:30:00.000Z";
const appointmentId = AppointmentId.schema.parse("appt_001");
const scheduled = Appointment.book({ id: appointmentId, petId: PetId.schema.parse("pet_001"), scheduledAt: NOW });
const checkedIn = Appointment.checkIn(scheduled, NOW);
const inputFor = (eventStore: ReturnType<typeof createInMemoryDomainEventStore>) => ({
  appointmentId: "appt_001", veterinarianId: "vet_001", eventId: "event_001", occurredAt: NOW, eventStore,
});

describe("03 Result と domain event", () => {
  test("チェックイン済みなら診察を開始し、イベントを記録する", () => {
    const repo = createInMemoryAppointmentRepository([checkedIn]);
    const events = createInMemoryDomainEventStore();
    const result = startExaminationUseCase(repo, inputFor(events));
    expect(result.kind).toBe("Ok");
    expect(events.all()).toEqual([expect.objectContaining({ kind: "ExaminationStarted", appointmentId })]);
  });

  test("失敗理由を Result で返し、イベントを記録しない", () => {
    const missingEvents = createInMemoryDomainEventStore();
    const missing = startExaminationUseCase(createInMemoryAppointmentRepository(), inputFor(missingEvents));
    expect(missing).toMatchObject({ kind: "Err", error: { kind: "AppointmentNotFound" } });
    expect(missingEvents.all()).toEqual([]);

    const scheduledEvents = createInMemoryDomainEventStore();
    const wrongState = startExaminationUseCase(createInMemoryAppointmentRepository([scheduled]), inputFor(scheduledEvents));
    expect(wrongState).toMatchObject({ kind: "Err", error: { kind: "InvalidAppointmentState" } });
    expect(scheduledEvents.all()).toEqual([]);

    const invalidEvents = createInMemoryDomainEventStore();
    const invalid = startExaminationUseCase(createInMemoryAppointmentRepository([checkedIn]), { ...inputFor(invalidEvents), appointmentId: "invalid" });
    expect(invalid).toMatchObject({ kind: "Err", error: { kind: "ValidationError" } });
    expect(invalidEvents.all()).toEqual([]);
  });
});
