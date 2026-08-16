import type { ResultAsync } from "neverthrow";

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
export type UseCaseError =
  UnauthorizedError | AppointmentNotFound;
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

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)

      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.appointmentResolver
          .resolveById(input.appointmentId)
          ,
      )
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen((appointment) =>
        dependencies.ownerResolver
          .resolveById(appointment.ownerId)

          .map((owner) => ({ appointment, owner })),
      )
      .andThen(({ appointment, owner }) =>
        dependencies.petResolver
          .resolveById(appointment.petId)

          .map((pet) => ({ appointment, owner, pet })),
      )
      .andThen(({ appointment, owner, pet }) =>
        dependencies.veterinarianResolver
          .resolveAll()

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
