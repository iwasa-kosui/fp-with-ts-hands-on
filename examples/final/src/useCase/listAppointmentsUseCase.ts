import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../domain/aggregate/timestamp.js";
import type { Appointment } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentListResolver } from "../domain/appointment/appointmentResolver.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { PaymentAmount } from "../domain/appointment/paymentAmount.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerName } from "../domain/owner/ownerName.js";
import type { OwnerListResolver } from "../domain/owner/ownerResolver.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetName } from "../domain/pet/petName.js";
import type { PetListResolver } from "../domain/pet/petResolver.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserName } from "../domain/user/userName.js";
import { assertNever } from "../domain/shared/assertNever.js";
import type {
  UserByIdResolver,
  UserListResolver,
} from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

type AppointmentViewBase = Readonly<{
  appointmentId: AppointmentId;
  ownerId: OwnerId;
  ownerName: OwnerName | undefined;
  petId: PetId;
  petName: PetName | undefined;
  scheduledAt: Timestamp;
}>;
type ScheduledAppointmentView = AppointmentViewBase & Readonly<{
  kind: "Scheduled";
}>;
type CheckedInAppointmentView = AppointmentViewBase & Readonly<{
  kind: "CheckedIn";
  checkedInAt: Timestamp;
}>;
type InExaminationAppointmentView = AppointmentViewBase & Readonly<{
  kind: "InExamination";
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  veterinarianName: UserName | undefined;
  examinationStartedAt: Timestamp;
}>;
type PaidAppointmentView = AppointmentViewBase & Readonly<{
  kind: "Paid";
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  veterinarianName: UserName | undefined;
  examinationStartedAt: Timestamp;
  amount: PaymentAmount;
  paidAt: Timestamp;
}>;
type CanceledAppointmentView = AppointmentViewBase & Readonly<{
  kind: "Canceled";
  canceledAt: Timestamp;
}>;
export type AppointmentView =
  | ScheduledAppointmentView
  | CheckedInAppointmentView
  | InExaminationAppointmentView
  | PaidAppointmentView
  | CanceledAppointmentView;
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
export const toAppointmentView =
  (owners: readonly Owner[], pets: readonly Pet[], users: readonly User[]) =>
  (appointment: Appointment): AppointmentView => {
    const base = {
      appointmentId: appointment.appointmentId,
      ownerId: appointment.ownerId,
      ownerName:
        owners
          .find((owner) => owner.ownerId === appointment.ownerId)
          ?.name,
      petId: appointment.petId,
      petName: pets.find((pet) => pet.petId === appointment.petId)?.name,
      scheduledAt: appointment.scheduledAt,
    } as const;
    switch (appointment.kind) {
      case "Scheduled":
        return { ...base, kind: appointment.kind } as const satisfies ScheduledAppointmentView;
      case "CheckedIn":
        return {
          ...base,
          kind: appointment.kind,
          checkedInAt: appointment.checkedInAt,
        } as const satisfies CheckedInAppointmentView;
      case "InExamination": {
        const veterinarian = users.find(
          (user) =>
            user.kind === "Veterinarian" &&
            user.veterinarianId === appointment.veterinarianId,
        );
        return {
          ...base,
          kind: appointment.kind,
          checkedInAt: appointment.checkedInAt,
          veterinarianId: appointment.veterinarianId,
          veterinarianName: veterinarian?.name,
          examinationStartedAt: appointment.examinationStartedAt,
        } as const satisfies InExaminationAppointmentView;
      }
      case "Paid": {
        const veterinarian = users.find(
          (user) =>
            user.kind === "Veterinarian" &&
            user.veterinarianId === appointment.veterinarianId,
        );
        return {
          ...base,
          kind: appointment.kind,
          checkedInAt: appointment.checkedInAt,
          veterinarianId: appointment.veterinarianId,
          veterinarianName: veterinarian?.name,
          examinationStartedAt: appointment.examinationStartedAt,
          amount: appointment.amount,
          paidAt: appointment.paidAt,
        } as const satisfies PaidAppointmentView;
      }
      case "Canceled":
        return {
          ...base,
          kind: appointment.kind,
          canceledAt: appointment.canceledAt,
        } as const satisfies CanceledAppointmentView;
      default:
        return assertNever(appointment);
    }
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
