import { expect, it } from "vitest";

import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const veterinarianId = VeterinarianId.schema.parse(
  "44444444-4444-4444-8444-444444444444",
);
const checkedIn = Appointment.checkIn(
  Appointment.book({
    appointmentId,
    petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
    ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
    scheduledAt: "2026-08-30T06:30:00.000Z",
    reason: "skin check",
  }),
  "2026-08-30T06:20:00.000Z",
);

const rawInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  eventId: "55555555-5555-4555-8555-555555555555",
  occurredAt: "2026-08-30T06:30:00.000Z",
} as const;

it("成功した診察開始だけを domain event に残す", async () => {
  const [
    { startExaminationUseCase },
    { createInMemoryAppointmentRepository },
    { createInMemoryDomainEventStore },
  ] = await Promise.all([
    import("../src/application/start-examination.js"),
    import("../src/infrastructure/in-memory-appointment-repository.js"),
    import("../src/infrastructure/in-memory-domain-event-store.js"),
  ]);
  const repository = createInMemoryAppointmentRepository([checkedIn]);
  const eventStore = createInMemoryDomainEventStore();

  const result = startExaminationUseCase(repository, eventStore)(rawInput);

  expect(result.isOk()).toBe(true);
  expect(repository.findById(appointmentId)?.kind).toBe("InExamination");
  expect(eventStore.all()).toHaveLength(1);
  expect(eventStore.all()[0]).toEqual({
    kind: "ExaminationStarted",
    eventId: rawInput.eventId,
    occurredAt: rawInput.occurredAt,
    appointmentId,
    veterinarianId,
  });
});
