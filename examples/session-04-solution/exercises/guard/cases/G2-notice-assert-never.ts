import type { StartExaminationError } from "../../../src/useCase/errors.js";

type StartExaminationNoticeCode = "not-found" | "invalid-state";

export const startExaminationNoticeCodes: Readonly<
  Record<StartExaminationError["kind"], StartExaminationNoticeCode>
> = {
  AppointmentNotFound: "not-found",
  InvalidAppointmentState: "invalid-state",
};

const assertNever = (error: never): never => {
  throw new Error(`Unhandled start examination error: ${JSON.stringify(error)}`);
};

export const toStartExaminationNoticeCode = (
  error: StartExaminationError,
): StartExaminationNoticeCode => {
  switch (error.kind) {
    case "AppointmentNotFound":
      return startExaminationNoticeCodes.AppointmentNotFound;
    case "InvalidAppointmentState":
      return startExaminationNoticeCodes.InvalidAppointmentState;
    default:
      return assertNever(error);
  }
};
