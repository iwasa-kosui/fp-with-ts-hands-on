import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentId } from "../../../../domain/appointment/index.js";
import { AppointmentReason } from "../../../../domain/appointment/index.js";
import { CancellationReason } from "../../../../domain/appointment/index.js";
import { Diagnosis } from "../../../../domain/appointment/index.js";
import type {
  AppointmentByPetIdResolver,
  AppointmentByIdResolver,
  AppointmentListResolver,
} from "../../../../domain/appointment/index.js";
import { PaymentAmount } from "../../../../domain/appointment/index.js";
import { VeterinarianId } from "../../../../domain/appointment/index.js";
import { Treatment } from "../../../../domain/appointment/index.js";
import { ExamId } from "../../../../domain/examResult/index.js";
import { OwnerId } from "../../../../domain/owner/index.js";
import { PetId } from "../../../../domain/pet/index.js";
import type { SqliteDatabase } from "../db.js";
import { appointmentsTable } from "../schema.js";

const baseShape = {
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: AppointmentReason.schema,
};
const AppointmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Scheduled"), ...baseShape }),
  z.object({
    kind: z.literal("CheckedIn"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("InExamination"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
    veterinarianId: VeterinarianId.schema,
    examinationStartedAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("AwaitingPayment"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
    veterinarianId: VeterinarianId.schema,
    examinationStartedAt: Timestamp.schema,
    examId: ExamId.schema,
    examinationCompletedAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("Paid"),
    ...baseShape,
    checkedInAt: Timestamp.schema,
    veterinarianId: VeterinarianId.schema,
    examinationStartedAt: Timestamp.schema,
    examId: ExamId.schema,
    examinationCompletedAt: Timestamp.schema,
    diagnosis: Diagnosis.schema,
    treatment: Treatment.schema,
    amount: PaymentAmount.schema,
    paidAt: Timestamp.schema,
  }),
  z.object({
    kind: z.literal("Canceled"),
    appointmentId: AppointmentId.schema,
    petId: PetId.schema,
    ownerId: OwnerId.schema,
    scheduledAt: Timestamp.schema,
    reason: CancellationReason.schema,
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
  state: AppointmentSchema,
});

export const parseAppointmentState = (state: unknown) =>
  AppointmentSchema.parse(state);
export const parseAppointmentRow = (raw: unknown) => {
  const row = AppointmentRowSchema.parse(raw);
  if (
    row.appointmentId !== row.state.appointmentId ||
    row.status !== row.state.kind ||
    row.ownerId !== row.state.ownerId ||
    row.petId !== row.state.petId
  ) {
    throw new TypeError("Corrupt appointment projection");
  }
  return row.state;
};
export const createAppointmentByIdResolver = (
  db: SqliteDatabase,
): AppointmentByIdResolver => ({
  resolveById: (appointmentId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => {
        const row = db
          .select()
          .from(appointmentsTable)
          .where(eq(appointmentsTable.appointmentId, appointmentId))
          .get();
        return row === undefined ? undefined : parseAppointmentRow(row);
      }),
    ),
});

export const createAppointmentByPetIdResolver = (
  db: SqliteDatabase,
): AppointmentByPetIdResolver => ({
  resolveByPetId: (petId) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db
          .select()
          .from(appointmentsTable)
          .where(eq(appointmentsTable.petId, petId))
          .all()
          .map(parseAppointmentRow),
      ),
    ),
});

export const createAppointmentListResolver = (
  db: SqliteDatabase,
): AppointmentListResolver => ({
  resolveAll: () =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.select().from(appointmentsTable).all().map(parseAppointmentRow),
      ),
    ),
});
