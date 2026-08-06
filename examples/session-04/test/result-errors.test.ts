import { describe, expect, it } from "vitest";

import { startExaminationUseCase } from "../src/application/start-examination.js";
import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";
import { createInMemoryAppointmentRepository } from "../src/infrastructure/in-memory-appointment-repository.js";
import { createInMemoryDomainEventStore } from "../src/infrastructure/in-memory-domain-event-store.js";

const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();
const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444")._unsafeUnwrap();

const checkedIn = Appointment.checkIn(
  Appointment.book({
    appointmentId,
    petId,
    ownerId,
    scheduledAt: "2026-08-30T06:30:00.000Z",
    reason: "skin check",
  }),
  "2026-08-30T06:20:00.000Z",
);

const scheduled = Appointment.book({
  appointmentId,
  petId,
  ownerId,
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
});

const validInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  eventId: "55555555-5555-4555-8555-555555555555",
  occurredAt: "2026-08-30T06:30:00.000Z",
} as const;

describe("Session 04 start examination Result", () => {
  it("成功時だけ状態を保存し ExaminationStarted を記録する", () => {
    const repository = createInMemoryAppointmentRepository([checkedIn]);
    const eventStore = createInMemoryDomainEventStore();

    const success = startExaminationUseCase(repository, eventStore)(validInput);

    expect(success.isOk()).toBe(true);
    expect(repository.findById(appointmentId)?.kind).toBe("InExamination");
    expect(eventStore.all()).toHaveLength(1);
    expect(eventStore.all()[0]).toEqual({
      kind: "ExaminationStarted",
      eventId: "55555555-5555-4555-8555-555555555555",
      occurredAt: "2026-08-30T06:30:00.000Z",
      appointmentId: "11111111-1111-4111-8111-111111111111",
      veterinarianId: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("見つからない予約では状態も event も変えず AppointmentNotFound を返す", () => {
    const repository = createInMemoryAppointmentRepository([]);
    const eventStore = createInMemoryDomainEventStore();

    const result = startExaminationUseCase(repository, eventStore)(validInput);

    expect(result.isErr() && result.error.kind).toBe("AppointmentNotFound");
    expect(repository.findById(appointmentId)).toBeUndefined();
    expect(eventStore.all()).toEqual([]);
  });

  it("CheckedIn 以外の予約では状態も event も変えず InvalidAppointmentState を返す", () => {
    const repository = createInMemoryAppointmentRepository([scheduled]);
    const eventStore = createInMemoryDomainEventStore();

    const result = startExaminationUseCase(repository, eventStore)(validInput);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(repository.findById(appointmentId)).toEqual(scheduled);
    expect(eventStore.all()).toEqual([]);
  });

  it("不正な ID では状態も event も変えず ValidationError を返す", () => {
    const repository = createInMemoryAppointmentRepository([checkedIn]);
    const eventStore = createInMemoryDomainEventStore();

    const result = startExaminationUseCase(repository, eventStore)({
      ...validInput,
      appointmentId: "invalid",
    });

    expect(result.isErr() && result.error.kind).toBe("ValidationError");
    expect(repository.findById(appointmentId)).toEqual(checkedIn);
    expect(eventStore.all()).toEqual([]);
  });
});
