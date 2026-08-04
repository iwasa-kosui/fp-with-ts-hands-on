import type { AppointmentId } from "./appointment-id.js";
import type { PetId } from "./pet-id.js";
import type { VeterinarianId } from "./veterinarian-id.js";

export type CancelReason = "owner-request" | "clinic-capacity" | "duplicate-booking";

type AppointmentBase = Readonly<{ id: AppointmentId; petId: PetId; scheduledAt: string }>;
export type Scheduled = AppointmentBase & Readonly<{ kind: "Scheduled" }>;
export type CheckedIn = AppointmentBase & Readonly<{ kind: "CheckedIn"; checkedInAt: string }>;
export type InExamination = AppointmentBase & Readonly<{
  kind: "InExamination";
  checkedInAt: string;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;
export type Paid = AppointmentBase & Readonly<{
  kind: "Paid";
  checkedInAt: string;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  paidAt: string;
}>;
export type Canceled = AppointmentBase & Readonly<{
  kind: "Canceled";
  reason: CancelReason;
  canceledAt: string;
  followUpRequestedAt?: string;
}>;
export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type BookAppointmentInput = Readonly<{
  id: AppointmentId;
  petId: PetId;
  scheduledAt: string;
}>;
export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;

const book = (input: BookAppointmentInput): Scheduled => ({ kind: "Scheduled", ...input });
const checkIn = (appointment: Scheduled, now: string): CheckedIn => ({
  ...appointment,
  kind: "CheckedIn",
  checkedInAt: now,
});
const startExamination = (
  appointment: CheckedIn,
  veterinarianId: VeterinarianId,
  now: string,
): InExamination => ({ ...appointment, kind: "InExamination", veterinarianId, examinationStartedAt: now });
const recordPayment = (
  appointment: InExamination,
  input: RecordPaymentInput,
  now: string,
): Paid => ({ ...appointment, ...input, kind: "Paid", paidAt: now });
const cancelWithReason = (
  appointment: Scheduled | CheckedIn,
  reason: CancelReason,
  now: string,
  followUpRequestedAt?: string,
): Canceled => followUpRequestedAt === undefined
  ? { ...appointment, kind: "Canceled", reason, canceledAt: now }
  : { ...appointment, kind: "Canceled", reason, canceledAt: now, followUpRequestedAt };
const isTerminal = (appointment: Appointment): appointment is Paid | Canceled =>
  appointment.kind === "Paid" || appointment.kind === "Canceled";

export const Appointment: Readonly<{
  book: (input: BookAppointmentInput) => Scheduled;
  checkIn: (appointment: Scheduled, now: string) => CheckedIn;
  startExamination: (appointment: CheckedIn, veterinarianId: VeterinarianId, now: string) => InExamination;
  recordPayment: (appointment: InExamination, input: RecordPaymentInput, now: string) => Paid;
  cancelWithReason: (appointment: Scheduled | CheckedIn, reason: CancelReason, now: string, followUpRequestedAt?: string) => Canceled;
  isTerminal: (appointment: Appointment) => appointment is Paid | Canceled;
}> = { book, checkIn, startExamination, recordPayment, cancelWithReason, isTerminal };
