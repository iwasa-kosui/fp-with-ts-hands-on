import { err, ok, ResultAsync, type Result } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Appointment,
  type Appointment as AppointmentState,
  type DepositRuleError,
  type Scheduled,
  type CheckedIn,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type {
  AppointmentDepositReceivedStore,
  AppointmentStoreError,
  StaleAppointmentVersion,
} from "../domain/appointment/appointmentStores.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { PaymentAmount } from "../domain/appointment/paymentAmount.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import {
  ensureAppointmentFound,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";

export type ReceiveAppointmentDepositInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  depositAmount: PaymentAmount;
}>;
export type IdentityGenerationFailed = Readonly<{ kind: "IdentityGenerationFailed" }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | DepositRuleError
  | StaleAppointmentVersion
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  appointmentDepositReceivedStore: AppointmentDepositReceivedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type ReceiveAppointmentDepositUseCase = Readonly<{
  run: (input: ReceiveAppointmentDepositInput) => ResultAsync<Readonly<{ appointment: Scheduled | CheckedIn }>, UseCaseError>;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: AppointmentStoreError,
): StaleAppointmentVersion | UseCaseRepositoryError =>
  error.kind === "StaleAppointmentVersion"
    ? error
    : error.kind === "RepositoryError"
      ? toRepositoryError(error)
      : { kind: "RepositoryError", operation: "ReceiveAppointmentDepositUseCase.store" };
const ensureVersion =
  (input: ReceiveAppointmentDepositInput) =>
  (appointment: AppointmentState): Result<AppointmentState, StaleAppointmentVersion> =>
    appointment.version === input.expectedVersion
      ? ok(appointment)
      : err({
          kind: "StaleAppointmentVersion",
          appointmentId: input.appointmentId,
          expectedVersion: input.expectedVersion,
        });
const createEvent = (
  dependencies: Dependencies,
  input: ReceiveAppointmentDepositInput,
  appointment: AppointmentState,
) => ResultAsync.fromPromise(
  Promise.resolve().then(() => Appointment.receiveDeposit({
    eventId: dependencies.eventIdGenerator.generate(),
    occurredAt: dependencies.clock.now(),
    actorUserId: input.actorUserId,
  })(appointment, input.depositAmount)),
  (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
).andThen((result) => result);
const run =
  (dependencies: Dependencies) =>
  (input: ReceiveAppointmentDepositInput) =>
    dependencies.userResolver.resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() => dependencies.appointmentResolver.resolveById(input.appointmentId).mapErr(toRepositoryError))
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureVersion(input))
      .andThen((appointment) => createEvent(dependencies, input, appointment))
      .andThrough((event) => dependencies.appointmentDepositReceivedStore.store(event).mapErr(toStoreError))
      .map((event) => ({ appointment: event.aggregateState }));

export const ReceiveAppointmentDepositUseCase = {
  create: (dependencies: Dependencies): ReceiveAppointmentDepositUseCase => ({ run: run(dependencies) }),
} as const;
