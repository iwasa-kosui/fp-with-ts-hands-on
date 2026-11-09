import { errAsync, okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import { EventId } from "../../../../src/domain/aggregate/eventId.js";
import type { CheckedIn, ExaminationStarted } from "../../../../src/domain/appointment/index.js";
import { AppointmentId, VeterinarianId } from "../../../../src/domain/appointment/index.js";
import { OwnerId } from "../../../../src/domain/owner/index.js";
import { PetId } from "../../../../src/domain/pet/index.js";
import type { EffectsDependencies } from "../../../../src/useCase/dependencies.js";
import { startExaminationWithEffects } from "../../subjects/useCase.js";

const FIXED_EVENT_ID = EventId.parse("55555555-5555-4555-8555-555555555555");
const FIXED_OCCURRED_AT = "2026-08-30T06:30:00.000Z";
const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111");
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444");
const checkedIn = {
  kind: "CheckedIn",
  appointmentId,
  petId: PetId.parse("22222222-2222-4222-8222-222222222222"),
  ownerId: OwnerId.parse("33333333-3333-4333-8333-333333333333"),
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
  checkedInAt: "2026-08-30T06:20:00.000Z",
} as const satisfies CheckedIn;
const input = { appointmentId, veterinarianId } as const;

const createHarness = (options: Readonly<{ conflict?: boolean; ticking?: boolean }> = {}) => {
  const recordedEvents: Array<ExaminationStarted> = [];
  let storeCalls = 0;
  let clockReads = 0;
  const dependencies: EffectsDependencies = {
    resolver: { resolveById: () => checkedIn },
    clock: {
      now: () => {
        clockReads += 1;
        return options.ticking === true ? `2026-08-30T06:30:0${clockReads}.000Z` : FIXED_OCCURRED_AT;
      },
    },
    eventIdGenerator: { generate: () => FIXED_EVENT_ID },
    examinationStartedStore: {
      store: (event) => {
        storeCalls += 1;
        if (options.conflict === true) {
          return errAsync({ kind: "AppointmentConflict", appointmentId });
        }
        recordedEvents.push(event);
        return okAsync(undefined);
      },
    },
  };

  return {
    dependencies,
    recordedEvents,
    get storeCalls() {
      return storeCalls;
    },
    get clockReads() {
      return clockReads;
    },
  };
};

describe("startExaminationWithEffects", () => {
  it("固定の clock と ID generator から、同じイベントが決まる", async () => {
    const harness = createHarness();

    await startExaminationWithEffects(harness.dependencies)(input);

    expect(harness.recordedEvents.map(({ eventId, occurredAt }) => ({ eventId, occurredAt }))).toEqual([
      { eventId: FIXED_EVENT_ID, occurredAt: FIXED_OCCURRED_AT },
    ]);
  });

  it("状態と監査記録のために、store を1回だけ呼ぶ", async () => {
    const harness = createHarness();

    await startExaminationWithEffects(harness.dependencies)(input);

    expect(harness.storeCalls).toBe(1);
  });

  it("clock を1回だけ読み、イベントの時刻と診察開始の時刻が一致する", async () => {
    const harness = createHarness({ ticking: true });

    const result = await startExaminationWithEffects(harness.dependencies)(input);

    expect(harness.clockReads).toBe(1);
    expect(harness.recordedEvents[0]?.occurredAt).toBe(harness.recordedEvents[0]?.aggregateState.examinationStartedAt);
    expect(result.isOk() ? result.value.examinationStartedAt : undefined).toBe(harness.recordedEvents[0]?.occurredAt);
  });

  it("store が競合を返したら、呼び出し側に Err が返る", async () => {
    const harness = createHarness({ conflict: true });

    const result = await startExaminationWithEffects(harness.dependencies)(input);

    expect(result.isErr() ? result.error : undefined).toEqual({ kind: "AppointmentConflict", appointmentId });
  });
});
