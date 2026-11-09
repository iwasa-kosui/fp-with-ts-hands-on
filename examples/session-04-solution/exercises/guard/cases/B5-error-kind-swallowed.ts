import type { StartExaminationError } from "../../../src/useCase/errors.js";

type StartExaminationNoticeCode = "not-found" | "invalid-state";

type AppointmentCancelled = Readonly<{ kind: "AppointmentCancelled" }>;

export const toStartExaminationNoticeCode = (
  error: StartExaminationError | AppointmentCancelled,
): StartExaminationNoticeCode => {
  switch (error.kind) {
    case "AppointmentNotFound":
      return "not-found";
    case "InvalidAppointmentState":
      return "invalid-state";
    default:
      return "invalid-state";
  }
};
