import { describe, it } from "vitest";

import {
  assertCannotCancelWithoutReason,
  assertCannotStartExaminationFromPaid,
  assertOnlyAllowedStatesCanStartTransitions,
  assertStatusLabelHandlesNewAppointmentState,
} from "./typeRequirements.js";

describe("Step 1", () => {
  it("会計済みの来院から診察を開始できない", () => {
    assertCannotStartExaminationFromPaid();
  });
});

describe("Step 2", () => {
  it("キャンセルには必ず理由を残す", () => {
    assertCannotCancelWithoutReason();
  });
});

describe("Step 3", () => {
  it("許可されない状態から遷移できない", () => {
    assertOnlyAllowedStatesCanStartTransitions();
  });
});

describe("Step 4", () => {
  it("新しい予約状態を未対応のままにできない", () => {
    assertStatusLabelHandlesNewAppointmentState();
  });
});
