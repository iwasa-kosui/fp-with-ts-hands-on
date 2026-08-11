import { okAsync } from "neverthrow";
import { expect, it } from "vitest";

import { InMemoryAppointmentEventStore } from "../src/adaptor/inMemoryAppointmentEventStore.js";
import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointmentId.js";
import type { AppointmentResolver } from "../src/domain/appointmentResolver.js";
import { OwnerId } from "../src/domain/ownerId.js";
import { PetId } from "../src/domain/petId.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { StartExaminationUseCase } from "../src/useCase/startExaminationUseCase.js";

it("古い受付状態からの診察開始を片方も保存せず typed conflict にする", async () => {
  const appointmentId = AppointmentId.schema.parse(
    "11111111-1111-4111-8111-111111111111",
  );
  const scheduled = Appointment.book({
    appointmentId,
    petId: PetId.schema.parse("22222222-2222-4222-8222-222222222222"),
    ownerId: OwnerId.schema.parse("33333333-3333-4333-8333-333333333333"),
    scheduledAt: Timestamp.schema.parse("2026-08-30T06:00:00.000Z"),
  });
  const staleCheckedIn = Appointment.checkIn(
    scheduled,
    Timestamp.schema.parse("2026-08-30T06:10:00.000Z"),
  );
  const checkedIn = Appointment.checkIn(
    scheduled,
    Timestamp.schema.parse("2026-08-30T06:15:00.000Z"),
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
