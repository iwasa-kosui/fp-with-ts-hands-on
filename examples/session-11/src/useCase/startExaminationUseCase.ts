import { errAsync, type ResultAsync } from "neverthrow";

import type { AppointmentExaminationStarted } from "../domain/appointmentExaminationStarted.js";
import type { AppointmentResolver } from "../domain/appointmentResolver.js";
import type { ExaminationStartedStore } from "../domain/appointmentStores.js";
import type { RepositoryError } from "../domain/repositoryError.js";
import type {
  AppointmentNotFound,
  InvalidAppointmentState,
} from "../domain/startExaminationErrors.js";
import type { SchemaValidationError } from "../domain/shared/schemaResult.js";

export type StartExaminationUseCaseError =
  | SchemaValidationError
  | AppointmentNotFound
  | InvalidAppointmentState
  | RepositoryError;

export type StartExaminationUseCaseDependencies = Readonly<{
  appointmentResolver: AppointmentResolver;
  examinationStartedStore: ExaminationStartedStore;
}>;

export type StartExaminationUseCase = Readonly<{
  run: (
    rawInput: unknown,
  ) => ResultAsync<AppointmentExaminationStarted, StartExaminationUseCaseError>;
}>;

const run = (
  _rawInput: unknown,
): ResultAsync<AppointmentExaminationStarted, StartExaminationUseCaseError> =>
  errAsync({
    kind: "RepositoryError",
    operation: "start-examination",
    cause: "use case is not composed yet",
  });

export const StartExaminationUseCase = {
  create: (
    _dependencies: StartExaminationUseCaseDependencies,
  ): StartExaminationUseCase => ({ run }),
} as const;
