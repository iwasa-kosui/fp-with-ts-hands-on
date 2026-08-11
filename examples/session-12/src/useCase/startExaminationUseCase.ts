import type { ResultAsync } from "neverthrow";

import { Appointment } from "../domain/appointment.js";
import type { AppointmentExaminationStarted } from "../domain/appointmentExaminationStarted.js";
import type { AppointmentResolver } from "../domain/appointmentResolver.js";
import type {
  AppointmentStoreError,
  ExaminationStartedStore,
} from "../domain/appointmentStores.js";
import {
  ensureCheckedIn,
  ensureFound,
  type AppointmentNotFound,
  type InvalidAppointmentState,
} from "../domain/startExaminationErrors.js";
import { StartExaminationInput } from "../domain/startExaminationInput.js";
import type { SchemaValidationError } from "../domain/shared/schemaResult.js";

export type StartExaminationUseCaseError =
  | SchemaValidationError
  | AppointmentNotFound
  | InvalidAppointmentState
  | AppointmentStoreError;

export type StartExaminationUseCaseOutput = ResultAsync<
  AppointmentExaminationStarted,
  StartExaminationUseCaseError
>;

export type StartExaminationUseCaseDependencies = Readonly<{
  appointmentResolver: AppointmentResolver;
  examinationStartedStore: ExaminationStartedStore;
}>;

export type StartExaminationUseCase = Readonly<{
  run: (rawInput: unknown) => StartExaminationUseCaseOutput;
}>;

const run =
  ({
    appointmentResolver,
    examinationStartedStore,
  }: StartExaminationUseCaseDependencies) =>
  (rawInput: unknown): StartExaminationUseCaseOutput =>
    StartExaminationInput.parse(rawInput).asyncAndThen((input) =>
      appointmentResolver
        .resolveById(input.appointmentId)
        .andThen((appointment) => ensureFound(appointment, input.appointmentId))
        .andThen(ensureCheckedIn)
        .map((checkedIn) =>
          Appointment.startExamination({ occurredAt: input.startedAt })(
            checkedIn,
            input.veterinarianId,
          ),
        )
        .andThrough(examinationStartedStore.store),
    );

export const StartExaminationUseCase = {
  create: (
    dependencies: StartExaminationUseCaseDependencies,
  ): StartExaminationUseCase => ({ run: run(dependencies) }),
} as const;
