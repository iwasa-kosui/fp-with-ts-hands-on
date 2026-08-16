import { ok, safeTry, type ResultAsync } from "neverthrow";

import type { Timestamp } from "../domain/aggregate/timestamp.js";
import type { Appointment } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentListResolver } from "../domain/appointment/appointmentResolver.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { PaymentAmount } from "../domain/appointment/paymentAmount.js";
import type { ExamId } from "../domain/examResult/examId.js";
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
type AwaitingPaymentAppointmentView = AppointmentViewBase & Readonly<{
  kind: "AwaitingPayment";
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  veterinarianName: UserName | undefined;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
}>;
type PaidAppointmentView = AppointmentViewBase & Readonly<{
  kind: "Paid";
  checkedInAt: Timestamp;
  veterinarianId: VeterinarianId;
  veterinarianName: UserName | undefined;
  examinationStartedAt: Timestamp;
  examId: ExamId;
  examinationCompletedAt: Timestamp;
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
  | AwaitingPaymentAppointmentView
  | PaidAppointmentView
  | CanceledAppointmentView;
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ appointments: readonly AppointmentView[] }>;
export type UseCaseError = UnauthorizedError;
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

type AppointmentSources = Readonly<{
  appointments: readonly Appointment[];
  owners: readonly Owner[];
  pets: readonly Pet[];
  users: readonly User[];
}>;

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
      case "AwaitingPayment": {
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
          examId: appointment.examId,
          examinationCompletedAt: appointment.examinationCompletedAt,
        } as const satisfies AwaitingPaymentAppointmentView;
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
          examId: appointment.examId,
          examinationCompletedAt: appointment.examinationCompletedAt,
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

const loadSources =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): ResultAsync<AppointmentSources, UnauthorizedError> =>
    safeTry<AppointmentSources, UnauthorizedError>(async function* () {
      const actor = yield* dependencies.userResolver.resolveById(input.actorUserId);
      yield* ensureUserFound(input.actorUserId)(actor);
      const appointments = yield* dependencies.appointmentListResolver.resolveAll();
      const owners = yield* dependencies.ownerListResolver.resolveAll();
      const pets = yield* dependencies.petListResolver.resolveAll();
      const users = yield* dependencies.userListResolver.resolveAll();
      return ok({ appointments, owners, pets, users });
    });

const toAppointments = ({
  appointments,
  owners,
  pets,
  users,
}: AppointmentSources): UseCaseOk => ({
  appointments: appointments.map(toAppointmentView(owners, pets, users)),
});

const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    loadSources(dependencies)(input).map(toAppointments);

export const ListAppointmentsUseCase = {
  create: (dependencies: Dependencies): ListAppointmentsUseCase => ({
    run: run(dependencies),
  }),
} as const;
