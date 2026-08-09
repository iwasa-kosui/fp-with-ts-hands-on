import { and, eq, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../../../domain/appointment/appointmentVersion.js";
import { BookingKind } from "../../../../domain/appointment/bookingKind.js";
import { ReceptionNote } from "../../../../domain/appointment/receptionNote.js";
import { ServiceCode } from "../../../../domain/appointment/serviceCode.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import type { ReceptionBoardReader, ReceptionBoardReaderRow } from "../../../../useCase/query/receptionBoardReader.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable, ownersTable, petsTable, usersTable } from "../schema.js";

const NoPaymentSchema = z.object({ kind: z.literal("NoPayment") });
const DepositReceivedSchema = z.object({ kind: z.literal("DepositReceived") });
const SettledSchema = z.object({ kind: z.literal("Settled"), settledAt: Timestamp.schema });
const DepositRefundedSchema = z.object({ kind: z.literal("DepositRefunded") });
const ProjectedStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Scheduled"), settlement: z.union([NoPaymentSchema, DepositReceivedSchema]) }),
  z.object({ kind: z.literal("CheckedIn"), checkedInAt: Timestamp.schema, settlement: z.union([NoPaymentSchema, DepositReceivedSchema]) }),
  z.object({ kind: z.literal("InExamination"), checkedInAt: Timestamp.schema, examinationStartedAt: Timestamp.schema, settlement: z.union([NoPaymentSchema, DepositReceivedSchema]) }),
  z.object({ kind: z.literal("AwaitingPayment"), checkedInAt: Timestamp.schema, examinationStartedAt: Timestamp.schema, examinationCompletedAt: Timestamp.schema, settlement: z.union([NoPaymentSchema, DepositReceivedSchema]) }),
  z.object({ kind: z.literal("Paid"), checkedInAt: Timestamp.schema, examinationStartedAt: Timestamp.schema, examinationCompletedAt: Timestamp.schema, settlement: SettledSchema }),
  z.object({ kind: z.literal("Canceled"), canceledAt: Timestamp.schema, settlement: z.union([NoPaymentSchema, DepositRefundedSchema]) }),
]);
const RowSchema = z.object({
  appointmentId: AppointmentId.schema,
  version: AppointmentVersion.schema,
  bookingKind: BookingKind.schema,
  scheduledAt: Timestamp.schema,
  ownerName: z.string().min(1),
  petName: z.string().min(1),
  receptionNote: ReceptionNote.schema.nullable(),
  serviceCode: ServiceCode.schema,
  assignedVeterinarianId: VeterinarianId.schema.nullable(),
  assignedVeterinarianName: z.string().min(1).nullable(),
  appointmentStatus: z.enum(["Scheduled", "CheckedIn", "InExamination", "AwaitingPayment", "Paid", "Canceled"]),
  settlementStatus: z.enum(["NoPayment", "DepositReceived", "Settled", "DepositRefunded"]),
  state: ProjectedStateSchema,
});
type ParsedRow = z.infer<typeof RowSchema>;

const checkedInAtOf = (state: ParsedRow["state"]): z.infer<typeof Timestamp.schema> | null => {
  switch (state.kind) {
    case "Scheduled":
    case "Canceled": return null;
    case "CheckedIn":
    case "InExamination":
    case "AwaitingPayment":
    case "Paid": return state.checkedInAt;
    default: return state satisfies never;
  }
};
const statusSortAtOf = (row: ParsedRow): z.infer<typeof Timestamp.schema> => {
  switch (row.state.kind) {
    case "Scheduled": return row.scheduledAt;
    case "CheckedIn": return row.state.checkedInAt;
    case "InExamination": return row.state.examinationStartedAt;
    case "AwaitingPayment": return row.state.examinationCompletedAt;
    case "Paid": return row.state.settlement.settledAt;
    case "Canceled": return row.state.canceledAt;
    default: return row.state satisfies never;
  }
};
const expectedSettlement = (state: ParsedRow["state"]): ParsedRow["settlementStatus"] =>
  state.settlement.kind;

const toReaderRow = (loadedAt: z.infer<typeof Timestamp.schema>) => (raw: unknown): ReceptionBoardReaderRow => {
  const row = RowSchema.parse(raw);
  if (row.appointmentStatus !== row.state.kind) throw new TypeError("Corrupt appointment status projection");
  const stateSettlement = expectedSettlement(row.state);
  if (stateSettlement !== row.settlementStatus) throw new TypeError("Corrupt settlement status projection");
  if (["InExamination", "AwaitingPayment", "Paid"].includes(row.appointmentStatus) && row.assignedVeterinarianId === null) throw new TypeError("Corrupt veterinarian projection");
  const checkedInAt = checkedInAtOf(row.state);
  return {
    appointmentId: row.appointmentId,
    version: row.version,
    bookingKind: row.bookingKind,
    scheduledAt: row.scheduledAt,
    checkedInAt,
    waitingMinutes: checkedInAt === null ? null : Math.max(0, Math.floor((Date.parse(loadedAt) - Date.parse(checkedInAt)) / 60_000)),
    ownerName: row.ownerName,
    petName: row.petName,
    receptionNote: row.receptionNote,
    serviceCode: row.serviceCode,
    assignedVeterinarianId: row.assignedVeterinarianId,
    assignedVeterinarianName: row.assignedVeterinarianName,
    appointmentStatus: row.appointmentStatus,
    settlementStatus: row.settlementStatus,
    statusSortAt: statusSortAtOf(row),
  };
};

export const createReceptionBoardReader = (db: SqliteDatabase): ReceptionBoardReader => ({
  list: (_actor, range, loadedAt) => ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const scheduledInstant = sql<number>`julianday(${appointmentsTable.scheduledAt})`;
      return db.select({
      appointmentId: appointmentsTable.appointmentId,
      version: appointmentsTable.version,
      bookingKind: appointmentsTable.bookingKind,
      scheduledAt: appointmentsTable.scheduledAt,
      ownerName: ownersTable.name,
      petName: petsTable.name,
      receptionNote: appointmentsTable.receptionNote,
      serviceCode: appointmentsTable.serviceCode,
      assignedVeterinarianId: appointmentsTable.assignedVeterinarianId,
      assignedVeterinarianName: usersTable.name,
      appointmentStatus: appointmentsTable.status,
      settlementStatus: appointmentsTable.settlementStatus,
      state: appointmentsTable.state,
    }).from(appointmentsTable)
      .innerJoin(ownersTable, eq(ownersTable.ownerId, appointmentsTable.ownerId))
      .innerJoin(petsTable, eq(petsTable.petId, appointmentsTable.petId))
      .leftJoin(usersTable, and(eq(usersTable.veterinarianId, appointmentsTable.assignedVeterinarianId), eq(usersTable.role, "Veterinarian")))
      .where(sql`${scheduledInstant} >= julianday(${range.startsAt})
        AND ${scheduledInstant} < julianday(${range.endsAt})`)
      .all()
      .map(toReaderRow(loadedAt));
    }),
    (cause): RepositoryError => ({ kind: "RepositoryError", operation: "ReceptionBoardReader.list", cause }),
  ),
});
