import type { CancellationReason } from "./cancellationReason.js";

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  scheduledAt: Date;
  reason: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: string;
  scheduledAt: Date;
  reason: string;
  checkedInAt: Date;
}>;

export type Paid = Readonly<{
  kind: "Paid";
  appointmentId: string;
  scheduledAt: Date;
  reason: string;
  checkedInAt: Date;
  amount: number;
  paidAt: Date;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: string;
  scheduledAt: Date;
  reason: string;
  cancellationReason: CancellationReason;
  canceledAt: Date;
}>;

export type Appointment = Scheduled | CheckedIn | Paid | Canceled;

export const cancel = (
  appointment: Scheduled | CheckedIn,
  cancellationReason: CancellationReason,
  canceledAt: Date,
): Canceled => ({
  kind: "Canceled",
  appointmentId: appointment.appointmentId,
  scheduledAt: appointment.scheduledAt,
  reason: appointment.reason,
  cancellationReason,
  canceledAt,
});
