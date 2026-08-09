import type { ResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { BusinessDate } from "../domain/appointment/businessDate.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { ReceptionBoard, ReceptionBoardReader, ReceptionBoardReaderRow, ReceptionBoardRow, ReceptionPrimaryAction } from "./query/receptionBoardReader.js";

export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ board: ReceptionBoard }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError = UnauthorizedError | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  clock: Clock;
  userResolver: UserByIdResolver;
  receptionBoardReader: ReceptionBoardReader;
}>;
export type GetReceptionBoardUseCase = Readonly<{ run: (input: UseCaseInput) => UseCaseOutput }>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});

const actionFor = (actor: User, row: ReceptionBoardReaderRow): ReceptionPrimaryAction => {
  const manager = actor.kind === "Admin" || actor.kind === "Receptionist";
  if (row.appointmentStatus === "Scheduled" && manager) return "CheckIn";
  if (
    row.appointmentStatus === "CheckedIn" &&
    ((actor.kind === "Admin" && row.assignedVeterinarianId !== null) ||
      (actor.kind === "Veterinarian" &&
        (row.assignedVeterinarianId === null || row.assignedVeterinarianId === actor.veterinarianId)))
  ) return "StartExamination";
  if (row.appointmentStatus === "AwaitingPayment" && manager) return "Settle";
  return "OpenDetails";
};

const toBoardRow = (actor: User) => (row: ReceptionBoardReaderRow): ReceptionBoardRow => ({
  appointmentId: row.appointmentId,
  version: row.version,
  bookingKind: row.bookingKind,
  scheduledAt: row.scheduledAt,
  checkedInAt: row.checkedInAt,
  waitingMinutes: row.waitingMinutes,
  ownerName: row.ownerName,
  petName: row.petName,
  serviceCode: row.serviceCode,
  assignedVeterinarianName: row.assignedVeterinarianName,
  appointmentStatus: row.appointmentStatus,
  settlementStatus: row.settlementStatus,
  primaryAction: actionFor(actor, row),
});

const ascending = (left: ReceptionBoardReaderRow, right: ReceptionBoardReaderRow): number =>
  left.statusSortAt.localeCompare(right.statusSortAt) ||
  left.scheduledAt.localeCompare(right.scheduledAt) ||
  left.appointmentId.localeCompare(right.appointmentId);
const descending = (left: ReceptionBoardReaderRow, right: ReceptionBoardReaderRow): number =>
  -ascending(left, right);

const buildBoard = (
  actor: User,
  rows: readonly ReceptionBoardReaderRow[],
  loadedAt: ReturnType<Clock["now"]>,
): ReceptionBoard => {
  const businessDate = BusinessDate.fromTimestamp(loadedAt);
  const section = (status: ReceptionBoardReaderRow["appointmentStatus"], direction: "asc" | "desc" = "asc") =>
    rows.filter((row) => row.appointmentStatus === status)
      .sort(direction === "asc" ? ascending : descending)
      .map(toBoardRow(actor));
  return {
    businessDate,
    loadedAt,
    scheduled: section("Scheduled"),
    checkedIn: section("CheckedIn"),
    inExamination: section("InExamination"),
    awaitingPayment: section("AwaitingPayment"),
    paid: section("Paid", "desc"),
    canceled: section("Canceled", "desc"),
  };
};

const run = (dependencies: Dependencies) => (input: UseCaseInput): UseCaseOutput => {
  const loadedAt = dependencies.clock.now();
  const businessDate = BusinessDate.fromTimestamp(loadedAt);
  return dependencies.userResolver.resolveById(input.actorUserId)
    .mapErr(toRepositoryError)
    .andThen(ensureUserFound(input.actorUserId))
    .andThen((actor) => dependencies.receptionBoardReader
      .list(actor, BusinessDate.dayRange(businessDate), loadedAt)
      .mapErr(toRepositoryError)
      .map((rows) => ({ board: buildBoard(actor, rows, loadedAt) })));
};

export const GetReceptionBoardUseCase = {
  create: (dependencies: Dependencies): GetReceptionBoardUseCase => ({ run: run(dependencies) }),
} as const;
