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
  type AwaitingPayment,
  type Paid,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { Diagnosis } from "../domain/appointment/diagnosis.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { PaymentAmount } from "../domain/appointment/paymentAmount.js";
import type { Treatment } from "../domain/appointment/treatment.js";
import type { AppointmentConflict, AppointmentStoreError, PaymentRecordedStore } from "../domain/appointment/appointmentStores.js";
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
  diagnosis: Diagnosis;
  treatment: Treatment;
  amount: PaymentAmount;
}>;
export type UseCaseOk = Readonly<{ appointment: Paid }>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "AwaitingPayment";
  actualKind: Exclude<AppointmentState["kind"], "AwaitingPayment">;
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
  paymentRecordedStore: PaymentRecordedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type RecordPaymentUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensureAwaitingPayment = (
  appointment: AppointmentState,
): Result<AwaitingPayment, InvalidAppointmentState> =>
  appointment.kind === "AwaitingPayment"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "AwaitingPayment",
        actualKind: appointment.kind,
      });
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) =>
  (appointment: AwaitingPayment) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Appointment.recordPayment({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(appointment, {
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          amount: input.amount,
        }),
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
        dependencies.appointmentResolver
          .resolveById(input.appointmentId)
          ,
      )
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureAwaitingPayment)
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.paymentRecordedStore.store(event),
      )
      .map((event) => ({ appointment: event.aggregateState }));

export const RecordPaymentUseCase = {
  create: (dependencies: Dependencies): RecordPaymentUseCase => ({
    run: run(dependencies),
  }),
} as const;
