import { compileTypeFixture } from "./compileTypeFixture.js";

const assertTypeRequirement = (
  requirement: string,
  diagnostics: ReadonlyArray<string>,
): void => {
  if (diagnostics.length === 0) return;
  throw new Error(`型で守れていません: ${requirement}\n${diagnostics.join("\n")}`);
};

export const assertCannotStartExaminationFromPaid = (): void => {
  assertTypeRequirement(
    "会計済みの来院から診察を開始できない",
    compileTypeFixture("s2-paid-cannot-start.ts"),
  );
};

export const assertCannotCancelWithoutReason = (): void => {
  assertTypeRequirement(
    "キャンセルには理由が必要",
    compileTypeFixture("s2-cancel-requires-reason.ts"),
  );
};

export const assertOnlyAllowedStatesCanStartTransitions = (): void => {
  assertTypeRequirement(
    "許可されない状態から遷移できない",
    compileTypeFixture("s2-transition-sources.ts"),
  );
};

export const assertStatusLabelHandlesNewAppointmentState = (): void => {
  assertTypeRequirement(
    "新しい予約状態の表示を漏れなく決める",
    compileTypeFixture("s2-status-exhaustive.ts"),
  );
};
