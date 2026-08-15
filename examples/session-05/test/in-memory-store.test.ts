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

  it("adapter 内部では保存失敗の cause を RepositoryFailure に保持する", async () => {
    const diagnosticCause = new Error("storage unavailable");
    const adapter = createInMemoryExaminationStartedStore([checkedIn], {
      beforeCommit: () => Promise.reject(diagnosticCause),
    });
    const event = Appointment.startExamination({
      eventId,
      occurredAt: "2026-08-30T06:30:00.000Z",
    })(checkedIn, veterinarianId);

    const result = await adapter.store.store(event);

    expect(result.isErr() && result.error).toEqual({
      kind: "RepositoryFailure",
      operation: "ExaminationStartedStore.store",
      cause: diagnosticCause,
    });
    expect(adapter.appointments()).toEqual([checkedIn]);
    expect(adapter.events()).toEqual([]);
  });

  it("公開エラーから cause と PII を除き、commit 前の値を保つ", async () => {
    const privateDetails = {
      ownerName: "Owner Secret",
      email: "owner-secret@example.test",
      phone: "090-9999-9999",
      error: new Error("storage unavailable"),
    };
    const adapter = createInMemoryExaminationStartedStore([checkedIn], {
      beforeCommit: () => Promise.reject(privateDetails),
    });
    const result = await startExaminationWithEffects({
      resolver: adapter.resolver,
      store: adapter.store,
      clock: { now: () => "2026-08-30T06:30:00.000Z" },
      eventIdGenerator: { generate: () => eventId },
    })(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "RepositoryError",
      operation: "ExaminationStartedStore.store",
    });
    const serialized = JSON.stringify(result.isErr() ? result.error : undefined);
    expect(serialized).not.toContain(privateDetails.ownerName);
    expect(serialized).not.toContain(privateDetails.email);
    expect(serialized).not.toContain(privateDetails.phone);
    expect(serialized).not.toContain('"error"');
    expect(serialized).not.toContain("storage unavailable");
    expect(adapter.appointments()).toEqual([checkedIn]);
    expect(adapter.events()).toEqual([]);
  });
});
