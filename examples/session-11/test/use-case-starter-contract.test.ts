import type { ResultAsync } from "neverthrow";
import { expect, it } from "vitest";

import type { AppointmentNotFound, InvalidAppointmentState } from "../src/domain/startExaminationErrors.js";
import type { RepositoryError } from "../src/domain/repositoryError.js";
import type { SchemaValidationError } from "../src/domain/shared/schemaResult.js";
import type { AppointmentResolver } from "../src/domain/appointmentResolver.js";
import type { ExaminationStartedStore } from "../src/domain/appointmentStores.js";
import type { StartExaminationUseCaseError } from "../src/useCase/startExaminationUseCase.js";

type ErrorOf<T> = T extends ResultAsync<unknown, infer TError> ? TError : never;
type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends <
  T,
>() => T extends TRight ? 1 : 2
  ? (<T>() => T extends TRight ? 1 : 2) extends <T>() =>
      T extends TLeft ? 1 : 2
    ? true
    : false
  : false;

const errorContracts = [
  true satisfies Equal<ErrorOf<ReturnType<AppointmentResolver["resolveById"]>>, RepositoryError>,
  true satisfies Equal<ErrorOf<ReturnType<ExaminationStartedStore["store"]>>, RepositoryError>,
  true satisfies Equal<
    StartExaminationUseCaseError,
    | SchemaValidationError
    | AppointmentNotFound
    | InvalidAppointmentState
    | RepositoryError
  >,
] as const;

it("keeps the starter ports and use case on the typed error domain", () => {
  expect(errorContracts).toEqual([true, true, true]);
});
