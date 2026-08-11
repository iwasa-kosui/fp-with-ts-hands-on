import { okAsync } from "neverthrow";
import { expect, it } from "vitest";

import { InMemoryAppointmentEventStore } from "../src/adaptor/inMemoryAppointmentEventStore.js";
import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import type { AppointmentResolver } from "../src/domain/appointmentResolver.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarianId.js";
import { StartExaminationUseCase } from "../src/useCase/startExaminationUseCase.js";

const appointmentId = AppointmentId.schema.parse(
  "11111111-1111-4111-8111-111111111111",
);
const scheduled = Appointment.book({
  appointmentId,
  petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
});
const checkedIn = Appointment.checkIn(
  scheduled,
  Timestamp.schema.parse("2026-08-30T06:15:00.000Z"),
);

it("新しい受付状態からの診察開始で状態と event を一緒に保存する", async () => {
  const store = InMemoryAppointmentEventStore.create([checkedIn]);
  const event = Appointment.startExamination({
    occurredAt: Timestamp.schema.parse("2026-08-30T06:30:00.000Z"),
  })(
    checkedIn,
    VeterinarianId.schema.parse("44444444-4444-4444-8444-444444444444"),
  );

  const result = await store.store(event);

  expect(result.isOk()).toBe(true);
  expect(store.currentState(appointmentId)).toEqual(event.aggregateState);
  expect(store.events()).toEqual([event]);
});

it("古い受付状態からの診察開始を片方も保存せず typed conflict にする", async () => {
  const staleCheckedIn = Appointment.checkIn(
    scheduled,
    Timestamp.schema.parse("2026-08-30T06:10:00.000Z"),
  );
  const store = InMemoryAppointmentEventStore.create([checkedIn]);
  const appointmentResolver = {
    resolveById: () => okAsync(staleCheckedIn),
  } as const satisfies AppointmentResolver;
  const useCase = StartExaminationUseCase.create({
    appointmentResolver,
    examinationStartedStore: store,
  });

  const result = await useCase.run({
    appointmentId,
    veterinarianId: "44444444-4444-4444-8444-444444444444",
    startedAt: "2026-08-30T06:30:00.000Z",
  });

  expect(result.isErr() && result.error.kind).toBe("AppointmentConflict");
  expect(store.currentState(appointmentId)).toEqual(checkedIn);
  expect(store.events()).toEqual([]);
});
