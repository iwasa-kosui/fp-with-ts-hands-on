import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import type { CheckedIn, Scheduled } from "../../src/domain/appointment/appointment.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { AppointmentId } from "../../src/domain/ids/appointmentId.js";
import { OwnerId } from "../../src/domain/ids/ownerId.js";
import { PetId } from "../../src/domain/ids/petId.js";
import { VeterinarianId } from "../../src/domain/ids/veterinarianId.js";
import type { Dependencies } from "../../src/useCase/dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
} from "../../src/useCase/errors.js";
import { startExamination } from "../../src/useCase/startExamination.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
const eventId = EventId.parse("55555555-5555-4555-8555-555555555555");
const scheduled = {
  kind: "Scheduled",
  appointmentId,
  petId: PetId.parse(clinicFixture.petId),
  ownerId: OwnerId.parse(clinicFixture.ownerId),
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
} as const satisfies Scheduled;
const checkedIn = {
  ...scheduled,
  kind: "CheckedIn",
  checkedInAt: clinicFixture.checkedInAt,
} as const satisfies CheckedIn;
const input = { appointmentId, veterinarianId } as const;

describe("S3 Step 1 regression: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約を kind で識別できる", () => {
    const result = ensureCheckedIn(scheduled);
    expect(result.isErr() && result.error).toEqual({
      kind: "InvalidAppointmentState",
      actual: "Scheduled",
    });
  });
});

describe("S3 Step 2 regression: AppointmentNotFound を値として返す", () => {
  it("見つからない appointmentId をエラーへ残す", () => {
    const result = ensureAppointmentFound(undefined, appointmentId);
    expect(result.isErr() && result.error).toEqual({
      kind: "AppointmentNotFound",
      appointmentId,
    });
  });
});

describe("S3 Step 3 regression: andThen pipeline が成功値を運ぶ", () => {
  it("CheckedIn を InExamination へ遷移して保存する", async () => {
    const observer = { contextCalls: 0, storeCalls: 0 };
    const result = await startExamination(createDependencies(checkedIn, observer))(input);

    expect(result.isOk() && result.value.kind).toBe("InExamination");
    expect(observer).toEqual({ contextCalls: 2, storeCalls: 1 });
  });
});

describe("S3 Step 4 regression: 失敗後は遷移も保存もしない", () => {
  it("状態不正なら context 生成と store の呼出回数は 0 のまま", async () => {
    const observer = { contextCalls: 0, storeCalls: 0 };
    const result = await startExamination(createDependencies(scheduled, observer))(input);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(observer).toEqual({ contextCalls: 0, storeCalls: 0 });
  });
});

const createDependencies = (
  resolved: CheckedIn | Scheduled | undefined,
  observer: { contextCalls: number; storeCalls: number },
): Dependencies => ({
  resolver: { resolveById: () => resolved },
  clock: {
    now: () => {
      observer.contextCalls += 1;
      return "2026-08-30T06:30:00.000Z";
    },
  },
  eventIdGenerator: {
    generate: () => {
      observer.contextCalls += 1;
      return eventId;
    },
  },
  store: {
    store: () => {
      observer.storeCalls += 1;
      return okAsync(undefined);
    },
  },
});
