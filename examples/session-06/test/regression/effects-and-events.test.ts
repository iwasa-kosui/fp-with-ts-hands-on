import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import type { Appointment, CheckedIn } from "../../src/domain/appointment/appointment.js";
import type { ExaminationStarted } from "../../src/domain/appointment/examinationStarted.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { AppointmentId } from "../../src/domain/ids/appointmentId.js";
import { OwnerId } from "../../src/domain/ids/ownerId.js";
import { PetId } from "../../src/domain/ids/petId.js";
import { VeterinarianId } from "../../src/domain/ids/veterinarianId.js";
import type { EffectsDependencies } from "../../src/useCase/dependencies.js";
import { startExaminationWithEffects } from "../../src/useCase/startExamination.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

const FIXED_EVENT_ID = EventId.parse("55555555-5555-4555-8555-555555555555");
const FIXED_OCCURRED_AT = "2026-08-30T06:30:00.000Z";
const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
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

describe("Step 1: 同じ clock と ID generator なら同じイベントになる", () => {
  it("固定 context から同じ eventId と occurredAt を返す", async () => {
    const harness = createHarness();

    await startExaminationWithEffects(harness.dependencies)(input);
    await startExaminationWithEffects(harness.dependencies)(input);

    expect(harness.recordedEvents.map(({ eventId, occurredAt }) => ({ eventId, occurredAt }))).toEqual([
      { eventId: FIXED_EVENT_ID, occurredAt: FIXED_OCCURRED_AT },
      { eventId: FIXED_EVENT_ID, occurredAt: FIXED_OCCURRED_AT },
    ]);
  });
});

describe("Step 2: 状態と監査記録は1回の保存で残る", () => {
  it("store(event) を1回だけ呼ぶ", async () => {
    const harness = createHarness();

    await startExaminationWithEffects(harness.dependencies)(input);

    expect(harness.storeCalls).toBe(1);
    expect(harness.storedStates).toHaveLength(1);
    expect(harness.recordedEvents).toHaveLength(1);
  });
});

describe("Step 3: 非同期保存後もイベントが pipeline に残る", () => {
  it("保存成功時は store の void ではなく aggregateState を返す", async () => {
    const harness = createHarness();

    const result = await startExaminationWithEffects(harness.dependencies)(input);

    expect(result.isOk() ? result.value : undefined).toMatchObject({
      kind: "InExamination",
      appointmentId,
    });
  });
});

describe("Step 4: 保存失敗時は状態も記録も残らない", () => {
  it("RepositoryError を返し in-memory state を変更しない", async () => {
    const harness = createHarness(true);

    const result = await startExaminationWithEffects(harness.dependencies)(input);

    expect(result.isErr() && result.error.kind).toBe("RepositoryError");
    expect(harness.storedStates).toEqual([]);
    expect(harness.recordedEvents).toEqual([]);
  });
});

const createHarness = (failStore = false) => {
  const storedStates: Array<Appointment> = [];
  const recordedEvents: Array<ExaminationStarted> = [];
  let storeCalls = 0;
  const dependencies: EffectsDependencies = {
    resolver: { resolveById: () => checkedIn },
    clock: { now: () => FIXED_OCCURRED_AT },
    eventIdGenerator: { generate: () => FIXED_EVENT_ID },
    store: {
      store: (event) => {
        storeCalls += 1;
        if (failStore) {
          return errAsync({
            kind: "RepositoryFailure",
            operation: "ExaminationStartedStore.store",
            cause: "write failed",
          });
        }
        storedStates.push(event.aggregateState);
        recordedEvents.push(event);
        return okAsync(undefined);
      },
    },
  };

  return {
    dependencies,
    storedStates,
    recordedEvents,
    get storeCalls() {
      return storeCalls;
    },
  };
};
