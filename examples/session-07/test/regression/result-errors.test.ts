import { describe, expect, it } from "vitest";

import type { Appointment, CheckedIn, Scheduled } from "../../src/domain/appointment/appointment.js";
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
import { compileWithAdditionalStartExaminationError } from "./compileTypeFixture.js";

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

describe("S5 Step 1 regression: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約を kind で識別できる", () => {
    const result = ensureCheckedIn(scheduled);
    expect(result.isErr() && result.error).toEqual({
      kind: "InvalidAppointmentState",
      actual: "Scheduled",
    });
  });
});

describe("S5 Step 2 regression: AppointmentNotFound を値として返す", () => {
  it("見つからない appointmentId をエラーへ残す", () => {
    const result = ensureAppointmentFound(undefined, appointmentId);
    expect(result.isErr() && result.error).toEqual({
      kind: "AppointmentNotFound",
      appointmentId,
    });
  });
});

describe("S5 Step 3 regression: andThen pipeline が失敗理由を運ぶ", () => {
  it("予約なしを InvalidAppointmentState に潰さず保存しない", () => {
    const observer = { saveCalls: 0 };
    const result = startExamination(createDependencies(undefined, observer))(input);

    expect(result.isErr() && result.error).toEqual({
      kind: "AppointmentNotFound",
      appointmentId,
    });
    expect(observer).toEqual({ saveCalls: 0 });
  });

  it("ドメインの状態遷移で CheckedIn を InExamination にして保存する", () => {
    const observer = { saveCalls: 0 };
    const result = startExamination(createDependencies(checkedIn, observer))(input);

    expect(result.isOk() && result.value).toEqual({
      ...checkedIn,
      kind: "InExamination",
      veterinarianId,
      examinationStartedAt: input.examinationStartedAt,
    });
    expect(observer).toEqual({ saveCalls: 1 });
  });

  it("状態不正なら保存しない", () => {
    const observer = { saveCalls: 0 };
    const result = startExamination(createDependencies(scheduled, observer))(input);

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(observer).toEqual({ saveCalls: 0 });
  });

  it("保存障害を業務エラーへ変換せず例外として伝える", () => {
    const saveError = new Error("database unavailable");
    const observer = { saveCalls: 0, saveError };

    expect(() => startExamination(createDependencies(checkedIn, observer))(input))
      .toThrow(saveError);
    expect(observer.saveCalls).toBe(1);
  });
});

describe("S5 Step 4 regression: Web側が業務エラーを漏れなく処理する", () => {
  it("業務エラーを追加すると未対応の分岐がコンパイルエラーになる", () => {
    expect(compileWithAdditionalStartExaminationError()).toEqual([]);
  });
});

const createDependencies = (
  resolved: Appointment | undefined,
  observer: {
    saveCalls: number;
    saveError?: Error;
  },
): Dependencies => ({
  resolver: { resolveById: () => resolved },
  store: {
    save: () => {
      observer.saveCalls += 1;
      if (observer.saveError !== undefined) {
        throw observer.saveError;
      }
    },
  },
});
