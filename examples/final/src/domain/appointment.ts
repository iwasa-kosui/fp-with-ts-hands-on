import { z } from "zod";

import { AppointmentId } from "./appointment-id.js";
import { OwnerId } from "./owner-id.js";
import { PetId } from "./pet-id.js";
import { Timestamp } from "./timestamp.js";
import { VeterinarianId } from "./veterinarian-id.js";

const ScheduledSchema = z.object({
  kind: z.literal("Scheduled"),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().min(1),
});

const CheckedInSchema = z.object({
  kind: z.literal("CheckedIn"),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().min(1),
  checkedInAt: Timestamp.schema,
});

const InExaminationSchema = z.object({
  kind: z.literal("InExamination"),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().min(1),
  checkedInAt: Timestamp.schema,
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: Timestamp.schema,
});

const PaidSchema = z.object({
  kind: z.literal("Paid"),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().min(1),
  checkedInAt: Timestamp.schema,
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: Timestamp.schema,
  diagnosis: z.string().min(1),
  treatment: z.string().min(1),
  amount: z.number().nonnegative(),
  paidAt: Timestamp.schema,
});

const CanceledSchema = z.object({
  kind: z.literal("Canceled"),
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: Timestamp.schema,
  reason: z.string().min(1),
  canceledAt: Timestamp.schema,
  followUpRequestedAt: Timestamp.schema.optional(),
});

const AppointmentSchema = z
  .discriminatedUnion("kind", [
    ScheduledSchema,
    CheckedInSchema,
    InExaminationSchema,
    PaidSchema,
    CanceledSchema,
  ])
  .readonly();

export type Scheduled = Readonly<z.infer<typeof ScheduledSchema>>;
export type CheckedIn = Readonly<z.infer<typeof CheckedInSchema>>;
export type InExamination = Readonly<z.infer<typeof InExaminationSchema>>;
export type Paid = Readonly<z.infer<typeof PaidSchema>>;
export type Canceled = Readonly<z.infer<typeof CanceledSchema>>;
export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type BookAppointmentInput = Readonly<Omit<Scheduled, "kind">>;
export type RecordPaymentInput = Readonly<Pick<Paid, "diagnosis" | "treatment" | "amount">>;
export type CancelReason = string;

export const Appointment = {
  schema: AppointmentSchema,
  book: (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input }),
  checkIn: (scheduled: Scheduled, checkedInAt: Timestamp): CheckedIn => ({
    ...scheduled,
    kind: "CheckedIn",
    checkedInAt,
  }),
  startExamination: (
    checkedIn: CheckedIn,
    veterinarianId: VeterinarianId,
    examinationStartedAt: Timestamp,
  ): InExamination => ({
    ...checkedIn,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt,
  }),
  recordPayment: (
    examining: InExamination,
    input: RecordPaymentInput,
    paidAt: Timestamp,
  ): Paid => ({ ...examining, ...input, kind: "Paid", paidAt }),
  cancelWithReason: (
    appointment: Scheduled | CheckedIn,
    reason: CancelReason,
    canceledAt: Timestamp,
    followUpRequestedAt?: Timestamp,
  ): Canceled => ({
    kind: "Canceled",
    appointmentId: appointment.appointmentId,
    petId: appointment.petId,
    ownerId: appointment.ownerId,
    scheduledAt: appointment.scheduledAt,
    reason,
    canceledAt,
    ...(followUpRequestedAt === undefined ? {} : { followUpRequestedAt }),
  }),
  isPaid: (appointment: Appointment) => appointment.kind === "Paid",
  isTerminal: (appointment: Appointment) =>
    appointment.kind === "Paid" || appointment.kind === "Canceled",
} as const;
