import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import {
  Appointment,
  type Appointment as AppointmentState,
  type CheckedIn,
  type Scheduled,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { AppointmentCheckedInStore, AppointmentConflict } from "../domain/appointment/appointmentStores.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import {
  ensureAppointmentFound,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
}>;
export type UseCaseOk = Readonly<{ appointment: CheckedIn }>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "Scheduled";
  actualKind: Exclude<AppointmentState["kind"], "Scheduled">;
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | IdentityGenerationFailed
  | AppointmentConflict;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  appointmentCheckedInStore: AppointmentCheckedInStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type CheckInAppointmentUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureScheduled = (
  appointment: AppointmentState,
): Result<Scheduled, InvalidAppointmentState> =>
  appointment.kind === "Scheduled"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "Scheduled",
        actualKind: appointment.kind,
      });
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) =>
  (appointment: Scheduled) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Appointment.checkIn({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(appointment),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.appointmentResolver.resolveById(input.appointmentId),
      )
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureScheduled)
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.appointmentCheckedInStore.store(event),
      )
      .map((event) => ({ appointment: event.aggregateState }));

export const CheckInAppointmentUseCase = {
  create: (dependencies: Dependencies): CheckInAppointmentUseCase => ({
    run: run(dependencies),
  }),
} as const;
