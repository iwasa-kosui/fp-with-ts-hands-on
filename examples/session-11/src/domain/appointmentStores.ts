import type { ResultAsync } from "neverthrow";

import type { AppointmentExaminationStarted } from "./appointmentExaminationStarted.js";
import type { RepositoryError } from "./repositoryError.js";

export type ExaminationStartedStore = Readonly<{
  store: (
    event: AppointmentExaminationStarted,
  ) => ResultAsync<void, RepositoryError>;
}>;
