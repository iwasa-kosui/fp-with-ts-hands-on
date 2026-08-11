import type { ResultAsync } from "neverthrow";

import type { AppointmentExaminationStarted } from "./appointmentExaminationStarted.js";

export type ExaminationStartedStore = Readonly<{
  store: (
    event: AppointmentExaminationStarted,
  ) => ResultAsync<void, unknown>;
}>;
