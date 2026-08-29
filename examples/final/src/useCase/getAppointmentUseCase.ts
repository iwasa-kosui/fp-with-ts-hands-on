import { ok, safeTry, type ResultAsync } from "neverthrow";

import type { Appointment } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";
import type { AppointmentByIdResolver } from "../domain/appointment/index.js";
import type { Owner } from "../domain/owner/index.js";
import type { OwnerByIdResolver } from "../domain/owner/index.js";
import type { Pet } from "../domain/pet/index.js";
import type { PetByIdResolver } from "../domain/pet/index.js";
import type { UserId } from "../domain/user/userId.js";
import type { User } from "../domain/user/user.js";
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

type AppointmentSources = Readonly<{
  appointment: Appointment;
  owner: Owner | undefined;
  pet: Pet | undefined;
  users: readonly User[];
}>;

const loadSources =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): ResultAsync<AppointmentSources, UseCaseError> =>
    safeTry<AppointmentSources, UseCaseError>(async function* () {
      const actor = yield* dependencies.userResolver.resolveById(input.actorUserId);
      yield* ensureUserFound(input.actorUserId)(actor);
      const appointment = yield* dependencies.appointmentResolver.resolveById(
        input.appointmentId,
      );
      const foundAppointment = yield* ensureAppointmentFound(input.appointmentId)(
        appointment,
      );
      const owner = yield* dependencies.ownerResolver.resolveById(
        foundAppointment.ownerId,
      );
      const pet = yield* dependencies.petResolver.resolveById(foundAppointment.petId);
      const users = yield* dependencies.veterinarianResolver.resolveAll();
      return ok({ appointment: foundAppointment, owner, pet, users });
    });

const toAppointment = ({
  appointment,
  owner,
  pet,
  users,
}: AppointmentSources): UseCaseOk => ({
  appointment: toAppointmentView(
    owner === undefined ? [] : [owner],
    pet === undefined ? [] : [pet],
    users,
  )(appointment),
});

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    loadSources(dependencies)(input).map(toAppointment);

export const GetAppointmentUseCase = {
  create: (dependencies: Dependencies): GetAppointmentUseCase => ({
    run: run(dependencies),
  }),
} as const;
