import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { OwnerByIdResolver } from "../domain/owner/ownerResolver.js";
import type { PetByIdResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
import {
  ensureAppointmentFound,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";
import {
  toAppointmentView,
  type AppointmentView,
} from "./listAppointmentsUseCase.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
}>;
export type UseCaseOk = Readonly<{ appointment: AppointmentView }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  UnauthorizedError | AppointmentNotFound | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  ownerResolver: OwnerByIdResolver;
  petResolver: PetByIdResolver;
  veterinarianResolver: UserListResolver;
}>;
export type GetAppointmentUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.appointmentResolver
          .resolveById(input.appointmentId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen((appointment) =>
        dependencies.ownerResolver
          .resolveById(appointment.ownerId)
          .mapErr(toRepositoryError)
          .map((owner) => ({ appointment, owner })),
      )
      .andThen(({ appointment, owner }) =>
        dependencies.petResolver
          .resolveById(appointment.petId)
          .mapErr(toRepositoryError)
          .map((pet) => ({ appointment, owner, pet })),
      )
      .andThen(({ appointment, owner, pet }) =>
        dependencies.veterinarianResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .map((users) => ({ appointment, owner, pet, users })),
      )
      .map(({ appointment, owner, pet, users }) => ({
        appointment: toAppointmentView(
          owner === undefined ? [] : [owner],
          pet === undefined ? [] : [pet],
          users,
        )(appointment),
      }));

export const GetAppointmentUseCase = {
  create: (dependencies: Dependencies): GetAppointmentUseCase => ({
    run: run(dependencies),
  }),
} as const;
