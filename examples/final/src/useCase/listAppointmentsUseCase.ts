import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../domain/aggregate/timestamp.js";
import type { Appointment } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentListResolver } from "../domain/appointment/appointmentResolver.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerListResolver } from "../domain/owner/ownerResolver.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetListResolver } from "../domain/pet/petResolver.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

const deletedLabel = "削除済み";

export type AppointmentView = Readonly<{
  appointmentId: AppointmentId;
  kind: Appointment["kind"];
  ownerId: OwnerId;
  ownerName: string;
  petId: PetId;
  petName: string;
  veterinarianId?: VeterinarianId;
  veterinarianName?: string;
  scheduledAt: Timestamp;
  checkedInAt?: Timestamp;
  examinationStartedAt?: Timestamp;
  amount?: number;
  paidAt?: Timestamp;
  canceledAt?: Timestamp;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ appointments: readonly AppointmentView[] }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentListResolver: AppointmentListResolver;
  ownerListResolver: OwnerListResolver;
  petListResolver: PetListResolver;
  userListResolver: UserListResolver;
}>;
export type ListAppointmentsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const veterinarianIdOf = (
  appointment: Appointment,
): VeterinarianId | undefined =>
  appointment.kind === "InExamination" || appointment.kind === "Paid"
    ? appointment.veterinarianId
    : undefined;
export const toAppointmentView =
  (owners: readonly Owner[], pets: readonly Pet[], users: readonly User[]) =>
  (appointment: Appointment): AppointmentView => {
    const veterinarianId = veterinarianIdOf(appointment);
    const veterinarian = users.find(
      (user) =>
        user.kind === "Veterinarian" && user.veterinarianId === veterinarianId,
    );
    const base: AppointmentView = {
      appointmentId: appointment.appointmentId,
      kind: appointment.kind,
      ownerId: appointment.ownerId,
      ownerName:
        owners
          .find((owner) => owner.ownerId === appointment.ownerId)
          ?.name.unwrap() ?? deletedLabel,
      petId: appointment.petId,
      petName:
        pets.find((pet) => pet.petId === appointment.petId)?.name ??
        deletedLabel,
      scheduledAt: appointment.scheduledAt,
      ...(appointment.kind === "CheckedIn" || appointment.kind === "InExamination" || appointment.kind === "Paid"
        ? { checkedInAt: appointment.checkedInAt }
        : {}),
      ...(appointment.kind === "InExamination" || appointment.kind === "Paid"
        ? { examinationStartedAt: appointment.examinationStartedAt }
        : {}),
      ...(appointment.kind === "Paid"
        ? { amount: appointment.amount, paidAt: appointment.paidAt }
        : {}),
      ...(appointment.kind === "Canceled"
        ? { canceledAt: appointment.canceledAt }
        : {}),
    } as const;
    return veterinarianId === undefined
      ? base
      : {
          ...base,
          veterinarianId,
          veterinarianName: veterinarian?.name.unwrap() ?? deletedLabel,
        };
  };
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(() =>
        dependencies.appointmentListResolver
          .resolveAll()
          .mapErr(toRepositoryError),
      )
      .andThen((appointments) =>
        dependencies.ownerListResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .map((owners) => ({ appointments, owners })),
      )
      .andThen(({ appointments, owners }) =>
        dependencies.petListResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .map((pets) => ({ appointments, owners, pets })),
      )
      .andThen(({ appointments, owners, pets }) =>
        dependencies.userListResolver
          .resolveAll()
          .mapErr(toRepositoryError)
          .map((users) => ({ appointments, owners, pets, users })),
      )
      .map(({ appointments, owners, pets, users }) => ({
        appointments: appointments.map(toAppointmentView(owners, pets, users)),
      }));

export const ListAppointmentsUseCase = {
  create: (dependencies: Dependencies): ListAppointmentsUseCase => ({
    run: run(dependencies),
  }),
} as const;
