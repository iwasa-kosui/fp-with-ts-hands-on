import { ok, safeTry, type ResultAsync } from "neverthrow";

import { Appointment } from "../domain/appointment/appointment.js";
import type { AppointmentListResolver } from "../domain/appointment/appointmentResolver.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerListResolver } from "../domain/owner/ownerResolver.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetListResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type { User } from "../domain/user/user.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import {
  toAppointmentView,
  type AppointmentView,
} from "./listAppointmentsUseCase.js";

export type DashboardCounts = Readonly<{
  owners: number;
  pets: number;
  appointments: number;
  activeAppointments: number;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{
  counts: DashboardCounts;
  activeAppointments: readonly AppointmentView[];
}>;
export type UseCaseError = UnauthorizedError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentListResolver: AppointmentListResolver;
  ownerListResolver: OwnerListResolver;
  petListResolver: PetListResolver;
  userListResolver: UserListResolver;
}>;
export type GetDashboardUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

type DashboardSources = Readonly<{
  appointments: readonly Appointment[];
  owners: readonly Owner[];
  pets: readonly Pet[];
  users: readonly User[];
}>;

const loadSources =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): ResultAsync<DashboardSources, UnauthorizedError> =>
    safeTry<DashboardSources, UnauthorizedError>(async function* () {
      const actor = yield* dependencies.userResolver.resolveById(input.actorUserId);
      yield* ensureUserFound(input.actorUserId)(actor);
      const appointments = yield* dependencies.appointmentListResolver.resolveAll();
      const owners = yield* dependencies.ownerListResolver.resolveAll();
      const pets = yield* dependencies.petListResolver.resolveAll();
      const users = yield* dependencies.userListResolver.resolveAll();
      return ok({ appointments, owners, pets, users });
    });

const toDashboard = ({
  appointments,
  owners,
  pets,
  users,
}: DashboardSources): UseCaseOk => {
  const activeAppointments = appointments.filter(Appointment.isActive);
  return {
    counts: {
      owners: owners.length,
      pets: pets.length,
      appointments: appointments.length,
      activeAppointments: activeAppointments.length,
    },
    activeAppointments: activeAppointments.map(toAppointmentView(owners, pets, users)),
  };
};

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    loadSources(dependencies)(input).map(toDashboard);

export const GetDashboardUseCase = {
  create: (dependencies: Dependencies): GetDashboardUseCase => ({
    run: run(dependencies),
  }),
} as const;
