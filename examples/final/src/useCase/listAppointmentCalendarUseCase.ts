import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { BusinessDate, type BusinessDate as BusinessDateValue } from "../domain/appointment/businessDate.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { AppointmentCalendarItem, AppointmentCalendarReader } from "./query/appointmentCalendarReader.js";

export type CalendarView = "day" | "week";
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  date: BusinessDateValue;
  view: CalendarView;
  veterinarianId: VeterinarianId | null;
  includeCanceled: boolean;
}>;
export type UseCaseOk = Readonly<{ appointments: readonly AppointmentCalendarItem[] }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentCalendarReader: AppointmentCalendarReader;
}>;
export type ListAppointmentCalendarUseCase = Readonly<{ run: (input: UseCaseInput) => UseCaseOutput }>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError", operation: error.operation,
});

const run = (dependencies: Dependencies) => (input: UseCaseInput): UseCaseOutput =>
  dependencies.userResolver.resolveById(input.actorUserId)
    .mapErr(toRepositoryError)
    .andThen(ensureUserFound(input.actorUserId))
    .andThen((actor) => dependencies.appointmentCalendarReader.list(
      actor,
      input.view === "day"
        ? BusinessDate.dayRange(input.date)
        : BusinessDate.weekRange(input.date),
    )
      .mapErr(toRepositoryError))
    .map((appointments) => appointments
      .filter((appointment) => input.includeCanceled || appointment.appointmentStatus !== "Canceled")
      .filter((appointment) => input.veterinarianId === null || appointment.assignedVeterinarianId === input.veterinarianId)
      .sort((left, right) =>
        left.startsAt.localeCompare(right.startsAt) || left.petName.localeCompare(right.petName, "ja"),
      ))
    .map((appointments) => ({ appointments }));

export const ListAppointmentCalendarUseCase = {
  create: (dependencies: Dependencies): ListAppointmentCalendarUseCase => ({ run: run(dependencies) }),
} as const;
