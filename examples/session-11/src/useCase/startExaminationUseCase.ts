import { errAsync, type ResultAsync } from "neverthrow";

import type { AppointmentExaminationStarted } from "../domain/appointmentExaminationStarted.js";
import type { AppointmentResolver } from "../domain/appointmentResolver.js";
import type { ExaminationStartedStore } from "../domain/appointmentStores.js";

export type StartExaminationUseCaseError = Readonly<{
  kind: "UseCaseNotImplemented";
}>;

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
  errAsync({ kind: "UseCaseNotImplemented" });

export const StartExaminationUseCase = {
  create: (
    _dependencies: StartExaminationUseCaseDependencies,
  ): StartExaminationUseCase => ({ run }),
} as const;
