import { describe, expect, it } from "vitest";

import { createInMemoryExaminationStartedStore } from "../src/adaptor/inMemoryExaminationStartedStore.js";
import { EventId } from "../src/domain/aggregate/eventId.js";
import type { CheckedIn } from "../src/domain/appointment/appointment.js";
import { Appointment } from "../src/domain/appointment/transitions.js";
import { AppointmentId } from "../src/domain/ids/appointmentId.js";
import { OwnerId } from "../src/domain/ids/ownerId.js";
import { PetId } from "../src/domain/ids/petId.js";
import { VeterinarianId } from "../src/domain/ids/veterinarianId.js";
import { startExaminationWithEffects } from "../src/useCase/startExamination.js";
import { clinicFixture } from "../../fixtures/clinic.js";

const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
const eventId = EventId.parse("55555555-5555-4555-8555-555555555555");
const conflictingEventId = EventId.parse("66666666-6666-4666-8666-666666666666");
const checkedIn = {
  kind: "CheckedIn",
  appointmentId,
  petId: PetId.parse(clinicFixture.petId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
  checkedInAt: clinicFixture.checkedInAt,
} as const satisfies CheckedIn;
const input = { appointmentId, veterinarianId } as const;

describe("in-memory ExaminationStarted store", () => {
  it("1回の store で aggregate state と event を反映する", async () => {
    const adapter = createInMemoryExaminationStartedStore([checkedIn]);
    const result = await startExaminationWithEffects({
      resolver: adapter.resolver,
      store: adapter.store,
      clock: { now: () => "2026-08-30T06:30:00.000Z" },
      eventIdGenerator: { generate: () => eventId },
    })(input);

    expect(result.isOk()).toBe(true);
    expect(adapter.storeCalls()).toBe(1);
    expect(adapter.appointments()[0]?.kind).toBe("InExamination");
    expect(adapter.events()).toHaveLength(1);
  });

  it("保存失敗を Result に変換せず同じ例外で reject する", async () => {
    const diagnosticCause = new Error("storage unavailable");
    const adapter = createInMemoryExaminationStartedStore([checkedIn], {
      beforeCommit: () => Promise.reject(diagnosticCause),
    });
    const event = Appointment.startExamination({
      eventId,
      occurredAt: "2026-08-30T06:30:00.000Z",
    })(checkedIn, veterinarianId);

    await expect(adapter.store.store(event)).rejects.toBe(diagnosticCause);
    expect(adapter.appointments()).toEqual([checkedIn]);
    expect(adapter.events()).toEqual([]);
  });

  it("開始済み予約への2件目を業務競合として返し監査イベントを追加しない", async () => {
    const adapter = createInMemoryExaminationStartedStore([checkedIn]);
    const firstEvent = Appointment.startExamination({
      eventId,
      occurredAt: "2026-08-30T06:30:00.000Z",
    })(checkedIn, veterinarianId);
    const conflictingEvent = Appointment.startExamination({
      eventId: conflictingEventId,
      occurredAt: "2026-08-30T06:31:00.000Z",
    })(checkedIn, veterinarianId);

    const firstResult = await adapter.store.store(firstEvent);
    const conflictResult = await adapter.store.store(conflictingEvent);

    expect(firstResult.isOk()).toBe(true);
    expect(conflictResult._unsafeUnwrapErr()).toEqual({
      kind: "AppointmentConflict",
      appointmentId,
    });
    expect(adapter.appointments()).toEqual([firstEvent.aggregateState]);
    expect(adapter.events()).toEqual([firstEvent]);
  });

  it("use case も保存例外を捕捉せず、commit 前の値を保つ", async () => {
    const privateDetails = {
      ownerName: "Owner Secret",
      email: "owner-secret@example.test",
      phone: "090-9999-9999",
      message: "S5 storage unavailable for Owner Secret",
      stack: "S4DiagnosticError: storage unavailable\n    at ExaminationStartedStore.store",
      error: new Error("S5 storage unavailable for Owner Secret"),
    } as const;
    const adapter = createInMemoryExaminationStartedStore([checkedIn], {
      beforeCommit: () => Promise.reject(privateDetails),
    });
    await expect(
      startExaminationWithEffects({
        resolver: adapter.resolver,
        store: adapter.store,
        clock: { now: () => "2026-08-30T06:30:00.000Z" },
        eventIdGenerator: { generate: () => eventId },
      })(input),
    ).rejects.toBe(privateDetails);
    expect(adapter.appointments()).toEqual([checkedIn]);
    expect(adapter.events()).toEqual([]);
  });
});
