import { err, ok, ResultAsync, type Result, type ResultAsync as UseResultAsync } from "neverthrow";
import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { Appointment, type Appointment as AppointmentState, type CheckedIn, type Scheduled } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { AppointmentStoreError, AppointmentVeterinarianReassignedStore, StaleAppointmentVersion, VeterinarianScheduleConflict } from "../domain/appointment/appointmentStores.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver, UserListResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureAppointmentFound, ensureUserFound, type AppointmentNotFound, type UnauthorizedError } from "./errors.js";
import type { IdentityGenerationFailed, UseCaseRepositoryError, VeterinarianNotFound } from "./updateAppointmentUseCase.js";
export type ReassignAppointmentVeterinarianInput = Readonly<{ actorUserId: UserId; appointmentId: AppointmentId; expectedVersion: AppointmentVersion; assignedVeterinarianId: VeterinarianId | null }>;
export type InvalidAppointmentState = Readonly<{ kind: "InvalidAppointmentState"; appointmentId: AppointmentId; expectedKind: "ScheduledOrCheckedIn"; actualKind: Exclude<AppointmentState["kind"], "Scheduled" | "CheckedIn"> }>;
export type UseCaseError = UnauthorizedError | AppointmentNotFound | InvalidAppointmentState | VeterinarianNotFound | StaleAppointmentVersion | VeterinarianScheduleConflict | IdentityGenerationFailed | UseCaseRepositoryError;
export type UseCaseOk = Readonly<{ appointment: Scheduled | CheckedIn }>;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{ userResolver: UserByIdResolver; userListResolver: UserListResolver; appointmentResolver: AppointmentByIdResolver; appointmentVeterinarianReassignedStore: AppointmentVeterinarianReassignedStore; clock: Clock; eventIdGenerator: EventIdGenerator }>;
export type ReassignAppointmentVeterinarianUseCase = Readonly<{ run: (input: ReassignAppointmentVeterinarianInput) => UseCaseOutput }>;
const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({ kind: "RepositoryError", operation: error.operation });
const toStoreError = (error: AppointmentStoreError): UseCaseRepositoryError | StaleAppointmentVersion | VeterinarianScheduleConflict => error.kind === "RepositoryError" ? toRepositoryError(error) : error;
const ensureVersion = (input: ReassignAppointmentVeterinarianInput) => (appointment: AppointmentState): Result<AppointmentState, StaleAppointmentVersion> => appointment.version === input.expectedVersion ? ok(appointment) : err({ kind: "StaleAppointmentVersion", appointmentId: input.appointmentId, expectedVersion: input.expectedVersion });
const ensureReassignable = (appointment: AppointmentState): Result<Scheduled | CheckedIn, InvalidAppointmentState> => appointment.kind === "Scheduled" || appointment.kind === "CheckedIn" ? ok(appointment) : err({ kind: "InvalidAppointmentState", appointmentId: appointment.appointmentId, expectedKind: "ScheduledOrCheckedIn", actualKind: appointment.kind });
const ensureVeterinarian = (veterinarianId: VeterinarianId | null) => (users: readonly User[]): Result<void, VeterinarianNotFound> => veterinarianId === null || users.some((user) => user.kind === "Veterinarian" && user.veterinarianId === veterinarianId) ? ok(undefined) : err({ kind: "VeterinarianNotFound", veterinarianId });
const createEvent = (dependencies: Dependencies, input: ReassignAppointmentVeterinarianInput, appointment: Scheduled | CheckedIn) => ResultAsync.fromPromise(Promise.resolve().then(() => Appointment.reassignVeterinarian({ eventId: dependencies.eventIdGenerator.generate(), occurredAt: dependencies.clock.now(), actorUserId: input.actorUserId })(appointment, input.assignedVeterinarianId)), (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }));
const run = (dependencies: Dependencies) => (input: ReassignAppointmentVeterinarianInput): UseCaseOutput => dependencies.userResolver.resolveById(input.actorUserId).mapErr(toRepositoryError)
  .andThen(ensureUserFound(input.actorUserId)).andThen(ensureCanManageClinic)
  .andThen(() => dependencies.appointmentResolver.resolveById(input.appointmentId).mapErr(toRepositoryError)).andThen(ensureAppointmentFound(input.appointmentId)).andThen(ensureVersion(input)).andThen(ensureReassignable)
  .andThen((appointment) => dependencies.userListResolver.resolveAll().mapErr(toRepositoryError).andThen(ensureVeterinarian(input.assignedVeterinarianId)).map(() => appointment))
  .andThen((appointment) => createEvent(dependencies, input, appointment)).andThrough((event) => dependencies.appointmentVeterinarianReassignedStore.store(event).mapErr(toStoreError)).map((event) => ({ appointment: event.aggregateState }));
export const ReassignAppointmentVeterinarianUseCase = { create: (dependencies: Dependencies): ReassignAppointmentVeterinarianUseCase => ({ run: run(dependencies) }) } as const;
