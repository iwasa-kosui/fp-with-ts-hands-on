import type { ResultAsync } from "neverthrow";

import type { AppointmentExaminationStarted } from "./appointmentExaminationStarted.js";
import type { AppointmentId } from "./appointmentId.js";
import type { RepositoryError } from "./repositoryError.js";

export type AppointmentConflict = Readonly<{
  kind: "AppointmentConflict";
  appointmentId: AppointmentId;
}>;

export type AppointmentStoreError = RepositoryError | AppointmentConflict;

export type ExaminationStartedStore = Readonly<{
  store: (
    event: AppointmentExaminationStarted,
  ) => ResultAsync<void, AppointmentStoreError>;
}>;
