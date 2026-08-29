import { err } from "neverthrow";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { compileWithAdditionalStartExaminationError } from "../test/regression/compileTypeFixture.js";
import type {
  Appointment,
  CheckedIn,
  Scheduled,
} from "../src/domain/appointment/appointment.js";
import { startExamination as transitionToInExamination } from "../src/domain/appointment/transitions.js";
import { AppointmentId } from "../src/domain/ids/appointmentId.js";
import { OwnerId } from "../src/domain/ids/ownerId.js";
import { PetId } from "../src/domain/ids/petId.js";
import { VeterinarianId } from "../src/domain/ids/veterinarianId.js";
import type { Dependencies } from "../src/useCase/dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
} from "../src/useCase/errors.js";
import { startExamination } from "../src/useCase/startExamination.js";
import { clinicFixture } from "../../fixtures/clinic.js";

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

describe("Step 1: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約でも例外を投げない", () => {
    expect(() => ensureCheckedIn(scheduled)).not.toThrow();
    const result = ensureCheckedIn(scheduled);
    expect(result).toEqual(err({
      kind: "InvalidAppointmentState",
      actual: "Scheduled",
    }));
  });
});

describe("Step 2: AppointmentNotFound を値として返す", () => {
  it("予約が見つからなくても例外を投げない", () => {
    expect(() => ensureAppointmentFound(undefined, appointmentId)).not.toThrow();
    const result = ensureAppointmentFound(undefined, appointmentId);
    expect(result).toEqual(err({ kind: "AppointmentNotFound", appointmentId }));
  });
});

describe("Step 3: andThen pipeline が失敗理由を運ぶ", () => {
  it("予約なしを保持し、遷移も保存も実行しない", () => {
    let transitionCalls = 0;
    let saveCalls = 0;
    const deps = createDependencies(undefined, {
      onTransition: () => {
        transitionCalls += 1;
      },
      onSave: () => {
        saveCalls += 1;
      },
    });
    const result = startExamination(deps)(input);

    expect(result).toEqual(err({ kind: "AppointmentNotFound", appointmentId }));
    expect(transitionCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it("状態不正の後も遷移と保存を実行しない", () => {
    let transitionCalls = 0;
    let saveCalls = 0;
    const deps = createDependencies(scheduled, {
      onTransition: () => {
        transitionCalls += 1;
      },
      onSave: () => {
        saveCalls += 1;
      },
    });
    const result = startExamination(deps)(input);

    expect(result).toEqual(err({
      kind: "InvalidAppointmentState",
      actual: "Scheduled",
    }));
    expect(transitionCalls).toBe(0);
    expect(saveCalls).toBe(0);
  });

  it("保存障害を業務エラーへ変換せず例外として伝える", () => {
    const saveFailure = new Error("database unavailable");
    const deps = createDependencies(checkedIn, {
      onSave: () => {
        throw saveFailure;
      },
    });

    expect(() => startExamination(deps)(input)).toThrow(saveFailure);
  });
});

describe("Step 4: 呼び出し側が業務エラーを漏れなく処理する", () => {
  it("状態不正を専用noticeへ変換する", async () => {
    const response = await post(
      createApp(),
      `/appointments/${clinicFixture.appointmentId}/start-examination`,
    );

    expect(response.headers.get("location")).toBe("/?notice=invalid-state");
  });

  it("予約なしを専用noticeへ変換する", async () => {
    const response = await post(
      createApp(),
      "/appointments/99999999-9999-4999-8999-999999999999/start-examination",
    );

    expect(response.headers.get("location")).toBe("/?notice=not-found");
  });

  it("業務エラーを追加すると未対応の分岐を型エラーにする", () => {
    expect(compileWithAdditionalStartExaminationError()).toEqual([]);
  });
});

const createDependencies = (
  resolved: Appointment | undefined,
  observer: Readonly<{
    onTransition?: () => void;
    onSave?: () => void;
  }> = {},
): Dependencies => ({
  resolver: { resolveById: () => resolved },
  transition: (appointment, nextVeterinarianId, examinationStartedAt) => {
    observer.onTransition?.();
    return transitionToInExamination(
      appointment,
      nextVeterinarianId,
      examinationStartedAt,
    );
  },
  store: {
    save: () => {
      observer.onSave?.();
    },
  },
});

const post = async (
  app: ReturnType<typeof createApp>,
  path: string,
): Promise<Response> =>
  app.request(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "X-Inertia": "true",
      "X-Inertia-Version": "1",
    },
  });
