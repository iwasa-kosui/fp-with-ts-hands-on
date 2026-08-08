import type { ResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Appointment,
  type InExamination,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentResolver } from "../domain/appointment/appointmentResolver.js";
import type { ExaminationStartedStore } from "../domain/appointment/appointmentStores.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import { ensureCanStartExamination } from "./authorization.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  ensureUserFound,
  type AppointmentNotFound,
  type InvalidAppointmentState,
  type UnauthorizedError,
} from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export type UseCaseOk = Readonly<{
  appointment: InExamination;
}>;

export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | RepositoryError;

export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;

export type Dependencies = Readonly<{
  userResolver: UserResolver;
  appointmentResolver: AppointmentResolver;
  examinationStartedStore: ExaminationStartedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;

export type StartExaminationUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const run =
  ({
    userResolver,
    appointmentResolver,
    examinationStartedStore,
    clock,
    eventIdGenerator,
  }: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    userResolver
      .resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanStartExamination(input.veterinarianId))
      .andThen(() => appointmentResolver.resolveById(input.appointmentId))
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        Appointment.startExamination({
          eventId: eventIdGenerator.generate(),
          occurredAt: clock.now(),
          actorUserId: input.actorUserId,
        })(appointment, input.veterinarianId),
      )
      .andThrough((event) => examinationStartedStore.store(event))
      .map((event) => ({ appointment: event.aggregateState }));

export const StartExaminationUseCase = {
  create: (dependencies: Dependencies): StartExaminationUseCase => ({
    run: run(dependencies),
  }),
} as const;
