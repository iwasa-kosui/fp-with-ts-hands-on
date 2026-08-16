import type { ResultAsync } from "neverthrow";

import { Appointment } from "../domain/appointment/appointment.js";
import type { AppointmentListResolver } from "../domain/appointment/appointmentResolver.js";
import type { OwnerListResolver } from "../domain/owner/ownerResolver.js";
import type { PetListResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
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

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)

      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.appointmentListResolver
          .resolveAll()
          ,
      )
      .andThen((appointments) =>
        dependencies.ownerListResolver
          .resolveAll()

          .map((owners) => ({ appointments, owners })),
      )
      .andThen(({ appointments, owners }) =>
        dependencies.petListResolver
          .resolveAll()

          .map((pets) => ({ appointments, owners, pets })),
      )
      .andThen(({ appointments, owners, pets }) =>
        dependencies.userListResolver
          .resolveAll()

          .map((users) => ({ appointments, owners, pets, users })),
      )
      .map(({ appointments, owners, pets, users }) => {
        const activeAppointments = appointments.filter(Appointment.isActive);
        return {
          counts: {
            owners: owners.length,
            pets: pets.length,
            appointments: appointments.length,
            activeAppointments: activeAppointments.length,
          },
          activeAppointments: activeAppointments.map(
            toAppointmentView(owners, pets, users),
          ),
        };
      });

export const GetDashboardUseCase = {
  create: (dependencies: Dependencies): GetDashboardUseCase => ({
    run: run(dependencies),
  }),
} as const;
