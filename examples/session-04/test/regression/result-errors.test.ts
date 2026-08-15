import { describe, expect, it } from "vitest";

import type { Appointment, CheckedIn, Scheduled } from "../../src/domain/appointment/appointment.js";
import { startExamination as transitionToInExamination } from "../../src/domain/appointment/transitions.js";
import { AppointmentId } from "../../src/domain/ids/appointmentId.js";
import { OwnerId } from "../../src/domain/ids/ownerId.js";
import { PetId } from "../../src/domain/ids/petId.js";
import { VeterinarianId } from "../../src/domain/ids/veterinarianId.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
} from "../../src/useCase/errors.js";
import type { ResultDependencies } from "../../src/useCase/resultDependencies.js";
import { startExamination } from "../../src/useCase/startExaminationResult.js";
import { clinicFixture } from "../../../fixtures/clinic.js";

const appointmentId = AppointmentId.parse(clinicFixture.appointmentId);
const veterinarianId = VeterinarianId.parse(clinicFixture.veterinarianId);
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
const input = {
  appointmentId,
  veterinarianId,
  examinationStartedAt: "2026-08-30T06:30:00.000Z",
} as const;

describe("Step 1 regression: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約を kind で識別できる", () => {
    const result = ensureCheckedIn(scheduled);
    expect(result.isErr() && result.error).toEqual({
      kind: "InvalidAppointmentState",
      actual: "Scheduled",
    });
  });
});

describe("Step 2 regression: AppointmentNotFound を値として返す", () => {
  it("見つからない appointmentId をエラーへ残す", () => {
    const result = ensureAppointmentFound(undefined, appointmentId);
    expect(result.isErr() && result.error).toEqual({
      kind: "AppointmentNotFound",
      appointmentId,
    });
  });
});

describe("Step 3 regression: andThen pipeline が成功値を運ぶ", () => {
  it("CheckedIn を InExamination へ遷移して保存する", () => {
    const observer = { transitionCalls: 0, saveCalls: 0 };
    const result = startExamination(createDependencies(checkedIn, observer))(input);

    expect(result.isOk() && result.value.kind).toBe("InExamination");
    expect(observer).toEqual({ transitionCalls: 1, saveCalls: 1 });
  });
});

describe("Step 4 regression: 失敗後は遷移も保存もしない", () => {
  it("状態不正なら transition と store の呼出回数は 0 のまま", () => {
    const observer = { transitionCalls: 0, saveCalls: 0 };
    const result = startExamination(createDependencies(scheduled, observer))(input);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(observer).toEqual({ transitionCalls: 0, saveCalls: 0 });
  });
});

const createDependencies = (
  resolved: Appointment | undefined,
  observer: { transitionCalls: number; saveCalls: number },
): ResultDependencies => ({
  resolver: { resolveById: () => resolved },
  transition: (appointment, nextVeterinarianId, examinationStartedAt) => {
    observer.transitionCalls += 1;
    return transitionToInExamination(
      appointment,
      nextVeterinarianId,
      examinationStartedAt,
    );
  },
  store: {
    save: () => {
      observer.saveCalls += 1;
    },
  },
});
