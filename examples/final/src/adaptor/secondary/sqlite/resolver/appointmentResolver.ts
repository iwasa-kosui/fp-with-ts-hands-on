import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { AppointmentDuration } from "../../../../domain/appointment/appointmentDuration.js";
import { AppointmentReason } from "../../../../domain/appointment/appointmentReason.js";
import { AppointmentVersion } from "../../../../domain/appointment/appointmentVersion.js";
import { BookingKind } from "../../../../domain/appointment/bookingKind.js";
import { CancellationReason } from "../../../../domain/appointment/cancellationReason.js";
import { Diagnosis } from "../../../../domain/appointment/diagnosis.js";
import type {
  AppointmentByPetIdResolver,
  AppointmentByIdResolver,
  AppointmentListResolver,
} from "../../../../domain/appointment/appointmentResolver.js";
import { PaymentAmount } from "../../../../domain/appointment/paymentAmount.js";
import { ReceptionNote } from "../../../../domain/appointment/receptionNote.js";
import { ServiceCode } from "../../../../domain/appointment/serviceCode.js";
import { SettlementAdjustmentAmount } from "../../../../domain/appointment/settlementAdjustmentAmount.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { Treatment } from "../../../../domain/appointment/treatment.js";
import { ExamId } from "../../../../domain/examResult/examId.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable } from "../schema.js";

const baseShape = {
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  durationMinutes: AppointmentDuration.schema,
  serviceCode: ServiceCode.schema,
  bookingKind: BookingKind.schema,
  assignedVeterinarianId: VeterinarianId.schema.nullable(),
  visitReason: AppointmentReason.schema,
  receptionNote: ReceptionNote.schema.nullable(),
  version: AppointmentVersion.schema,
};
const NoPaymentSchema = z.object({ kind: z.literal("NoPayment") });
const DepositReceivedSchema = z.object({
  kind: z.literal("DepositReceived"),
  depositAmount: PaymentAmount.schema,
  receivedAt: Timestamp.schema,
});
const SettledSchema = z.object({
  kind: z.literal("Settled"),
  finalAmount: PaymentAmount.schema,
  depositAmount: SettlementAdjustmentAmount.schema,
  additionalPaymentAmount: SettlementAdjustmentAmount.schema,
  refundAmount: SettlementAdjustmentAmount.schema,
  settledAt: Timestamp.schema,
});
const DepositRefundedSchema = z.object({
  kind: z.literal("DepositRefunded"),
  depositAmount: PaymentAmount.schema,
  refundedAt: Timestamp.schema,
});
const AppointmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("Scheduled"),
    ...baseShape,
    settlement: z.union([NoPaymentSchema, DepositReceivedSchema]),
  }),
  z.object({
    kind: z.literal("CheckedIn"),
    ...baseShape,
    settlement: z.union([NoPaymentSchema, DepositReceivedSchema]),
    checkedInAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("InExamination"),
    ...baseShape,
    assignedVeterinarianId: VeterinarianId.schema,
    settlement: z.union([NoPaymentSchema, DepositReceivedSchema]),
    checkedInAt: Timestamp.schema,
    examinationStartedAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("AwaitingPayment"),
    ...baseShape,
    assignedVeterinarianId: VeterinarianId.schema,
    settlement: z.union([NoPaymentSchema, DepositReceivedSchema]),
    checkedInAt: Timestamp.schema,
    examinationStartedAt: Timestamp.schema,
    examId: ExamId.schema,
    examinationCompletedAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("Paid"),
    ...baseShape,
    assignedVeterinarianId: VeterinarianId.schema,
    settlement: SettledSchema,
    checkedInAt: Timestamp.schema,
    examinationStartedAt: Timestamp.schema,
    examId: ExamId.schema,
    examinationCompletedAt: Timestamp.schema,
    diagnosis: Diagnosis.schema,
    treatment: Treatment.schema,
  }),
  z.object({
    kind: z.literal("Canceled"),
    ...baseShape,
    settlement: z.union([NoPaymentSchema, DepositRefundedSchema]),
    cancellationReason: CancellationReason.schema,
    canceledAt: Timestamp.schema,
  }),
]);
const AppointmentStatusSchema = z.enum([
  "Scheduled",
  "CheckedIn",
  "InExamination",
  "AwaitingPayment",
  "Paid",
  "Canceled",
]);
const AppointmentRowSchema = z.object({
  appointmentId: AppointmentId.schema,
  status: AppointmentStatusSchema,
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  scheduledAt: Timestamp.schema,
  durationMinutes: AppointmentDuration.schema,
  serviceCode: ServiceCode.schema,
  bookingKind: BookingKind.schema,
  assignedVeterinarianId: VeterinarianId.schema.nullable(),
  receptionNote: z.string().nullable(),
  settlementStatus: z.enum([
    "NoPayment",
    "DepositReceived",
    "Settled",
    "DepositRefunded",
  ]),
  depositAmount: z.number().int().nonnegative().nullable(),
  version: AppointmentVersion.schema,
  state: AppointmentSchema,
});

const depositAmountOf = (state: z.infer<typeof AppointmentSchema>): number | null =>
  state.settlement.kind === "NoPayment" ? null : state.settlement.depositAmount;
const receptionNoteOf = (state: z.infer<typeof AppointmentSchema>): string | null =>
  state.receptionNote?.unwrap() ?? null;

export const parseAppointmentState = (state: unknown) =>
  AppointmentSchema.parse(state);
export const parseAppointmentRow = (raw: unknown) => {
  const row = AppointmentRowSchema.parse(raw);
  if (
    row.appointmentId !== row.state.appointmentId ||
    row.status !== row.state.kind ||
    row.ownerId !== row.state.ownerId ||
    row.petId !== row.state.petId ||
    row.scheduledAt !== row.state.scheduledAt ||
    row.durationMinutes !== row.state.durationMinutes ||
    row.serviceCode !== row.state.serviceCode ||
    row.bookingKind !== row.state.bookingKind ||
    row.assignedVeterinarianId !== row.state.assignedVeterinarianId ||
    row.receptionNote !== receptionNoteOf(row.state) ||
    row.settlementStatus !== row.state.settlement.kind ||
    row.depositAmount !== depositAmountOf(row.state) ||
    row.version !== row.state.version
  ) {
    throw new TypeError("Corrupt appointment projection");
  }
  return row.state;
};
const repositoryError =
  (operation: string) =>
  (cause: unknown): RepositoryError => ({
    kind: "RepositoryError",
    operation,
    cause,
  });

export const createAppointmentByIdResolver = (
  db: SqliteDatabase,
): AppointmentByIdResolver => ({
  resolveById: (appointmentId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() => {
        const row = db
          .select()
          .from(appointmentsTable)
          .where(eq(appointmentsTable.appointmentId, appointmentId))
          .get();
        return row === undefined ? undefined : parseAppointmentRow(row);
      }),
      repositoryError("AppointmentByIdResolver.resolveById"),
    ),
});

export const createAppointmentByPetIdResolver = (
  db: SqliteDatabase,
): AppointmentByPetIdResolver => ({
  resolveByPetId: (petId) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select()
          .from(appointmentsTable)
          .where(eq(appointmentsTable.petId, petId))
          .all()
          .map(parseAppointmentRow),
      ),
      repositoryError("AppointmentByPetIdResolver.resolveByPetId"),
    ),
});

export const createAppointmentListResolver = (
  db: SqliteDatabase,
): AppointmentListResolver => ({
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(appointmentsTable).all().map(parseAppointmentRow),
      ),
      repositoryError("AppointmentListResolver.resolveAll"),
    ),
});
