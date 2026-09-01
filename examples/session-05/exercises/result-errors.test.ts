import { err } from "neverthrow";
import { describe, expect, expectTypeOf, it } from "vitest";

import { createApp } from "../src/app.js";
import type {
  Appointment,
  CheckedIn,
  Scheduled,
} from "../src/domain/appointment/index.js";
import { AppointmentId } from "../src/domain/appointment/index.js";
import { OwnerId } from "../src/domain/owner/index.js";
import { PetId } from "../src/domain/pet/index.js";
import { VeterinarianId } from "../src/domain/appointment/index.js";
import type { Dependencies } from "../src/useCase/dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
} from "../src/useCase/errors.js";
import type { StartExaminationError } from "../src/useCase/errors.js"; // 要件: 予約なしと状態不正を、kindで区別できる診察開始エラーとして定義してください。
import { startExamination } from "../src/useCase/startExamination.js";
import type { startExaminationNoticeCodes } from "../src/web/routes.js"; // 要件: 診察開始エラーのkindをキーにした通知対応表を公開してください。
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

type AppointmentUnavailable = Readonly<{
  kind: "AppointmentUnavailable";
}>;

type ErrorWithNewVariant = StartExaminationError | AppointmentUnavailable;

describe("Step 1: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約でも例外を投げない", () => {
    try {
      const result = ensureCheckedIn(scheduled);
      expect(result).toEqual(err({
        kind: "InvalidAppointmentState",
        actual: "Scheduled",
      }));
    } catch {
      throw new Error("要件未達: 来院済みでない予約は状態不正として返してください。");
    }
  });
});

describe("Step 2: AppointmentNotFound を値として返す", () => {
  it("予約が見つからなくても例外を投げない", () => {
    try {
      const result = ensureAppointmentFound(undefined, appointmentId);
      expect(result).toEqual(err({ kind: "AppointmentNotFound", appointmentId }));
    } catch {
      throw new Error("要件未達: 見つからない予約は予約なしとして返してください。");
    }
  });
});

describe("Step 3: andThen pipeline が失敗理由を運ぶ", () => {
  it("予約なしを保持し、保存しない", () => {
    let saveCalls = 0;
    const deps = createDependencies(undefined, {
      onSave: () => {
        saveCalls += 1;
      },
    });
    try {
      const result = startExamination(deps)(input);
      expect(result).toEqual(err({ kind: "AppointmentNotFound", appointmentId }));
      expect(saveCalls).toBe(0);
    } catch {
      throw new Error("要件未達: 予約なしの理由を保持し、保存を実行しないでください。");
    }
  });

  it("状態不正の後も保存しない", () => {
    let saveCalls = 0;
    const deps = createDependencies(scheduled, {
      onSave: () => {
        saveCalls += 1;
      },
    });
    try {
      const result = startExamination(deps)(input);
      expect(result).toEqual(err({
        kind: "InvalidAppointmentState",
        actual: "Scheduled",
      }));
      expect(saveCalls).toBe(0);
    } catch {
      throw new Error("要件未達: 状態不正の理由を保持し、保存を実行しないでください。");
    }
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

    if (response.headers.get("location") !== "/?notice=invalid-state") {
      throw new Error("要件未達: 状態不正を専用のお知らせへ変換してください。");
    }
  });

  it("予約なしを専用noticeへ変換する", async () => {
    const response = await post(
      createApp(),
      "/appointments/99999999-9999-4999-8999-999999999999/start-examination",
    );

    expect(response.headers.get("location")).toBe("/?notice=not-found");
  });

  it("診察開始エラーのkindを通知対応表で漏れなく扱う", () => {
    expectTypeOf<keyof typeof startExaminationNoticeCodes>()
      .toEqualTypeOf<StartExaminationError["kind"]>(); // 要件: 通知対応表は診察開始エラーのkindを過不足なくキーにしてください。
  });

  it("業務エラーを追加すると通知対応表の不足を型で検出する", () => {
    expectTypeOf<keyof typeof startExaminationNoticeCodes>()
      .not.toEqualTypeOf<ErrorWithNewVariant["kind"]>(); // 要件: 業務エラーを追加したら通知対応表にもキーを追加してください。
  });
});

const createDependencies = (
  resolved: Appointment | undefined,
  observer: Readonly<{
    onSave?: () => void;
  }> = {},
): Dependencies => ({
  resolver: { resolveById: () => resolved },
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
