import { logger } from "./logger.js";

export type LegacyStatusExtra = Readonly<{
  veterinarianId?: string;
  checkedInAt?: string;
  examId?: string;
  examinationCompletedAt?: string;
  paidAt?: string;
  diagnosis?: string;
  treatment?: string;
  amount?: number;
  cancelReason?: string;
}>;

export type LegacyAppointment = Readonly<{
  id: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  scheduledAt: string;
  reason: string;
  status: string;
}> &
  LegacyStatusExtra;

export type BookAppointmentInput = Readonly<{
  id: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  scheduledAt: string;
  reason: string;
}>;

const appointments = new Map<string, LegacyAppointment>();

export const bookAppointment = (
  input: BookAppointmentInput,
): LegacyAppointment => {
  const appointment: LegacyAppointment = { ...input, status: "scheduled" };
  appointments.set(appointment.id, appointment);
  logger.info("appointment booked", appointment);
  return appointment;
};

export const updateStatus = (
  id: string,
  newStatus: string,
  extra: LegacyStatusExtra = {},
): LegacyAppointment => {
  const current = appointments.get(id);
  if (current === undefined) {
    throw new Error(`Appointment not found: ${id}`);
  }
  const updated = { ...current, ...extra, status: newStatus };
  appointments.set(id, updated);
  logger.info("appointment status updated", updated);
  return updated;
};

export const findAppointment = (
  id: string,
): LegacyAppointment | undefined => appointments.get(id);

export const resetLegacyStore = (): void => {
  appointments.clear();
};
