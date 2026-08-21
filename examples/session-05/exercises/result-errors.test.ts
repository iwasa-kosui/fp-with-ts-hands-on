import { describe, expect, it } from "vitest";

import type {
  Appointment,
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

const input = {
  appointmentId,
  veterinarianId,
  examinationStartedAt: "2026-08-30T06:30:00.000Z",
} as const;

describe("Step 1: InvalidAppointmentState を値として返す", () => {
  it("CheckedIn でない予約でも例外を投げない", () => {
    expect(() => ensureCheckedIn(scheduled)).not.toThrow();
    const result = ensureCheckedIn(scheduled);
    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
  });
});

describe("Step 2: AppointmentNotFound を値として返す", () => {
  it("予約が見つからなくても例外を投げない", () => {
    expect(() => ensureAppointmentFound(undefined, appointmentId)).not.toThrow();
    const result = ensureAppointmentFound(undefined, appointmentId);
    expect(result.isErr() && result.error.kind).toBe("AppointmentNotFound");
  });
});

describe("Step 3: andThen pipeline が失敗理由を運ぶ", () => {
  it("予約なしを InvalidAppointmentState に潰さない", () => {
    const deps = createDependencies(undefined);
    const result = startExamination(deps)(input);

    expect(result.isErr() && result.error.kind).toBe("AppointmentNotFound");
  });
});

describe("回帰条件: 失敗後は遷移も保存もしない", () => {
  it("状態不正なら transition と store の呼出回数は 0 のまま", () => {
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

    expect(result.isErr() && result.error.kind).toBe("InvalidAppointmentState");
    expect(transitionCalls).toBe(0);
    expect(saveCalls).toBe(0);
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
