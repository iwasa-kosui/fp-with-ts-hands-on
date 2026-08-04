import { logger } from "./logger.js";

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

export type LegacyStatusExtra = Readonly<{
  veterinarianId?: string;
  diagnosis?: string;
  treatment?: string;
  amount?: number;
}>;

export type LegacyAppointment = Readonly<BookAppointmentInput & {
  status: string;
  veterinarianId?: string;
  diagnosis?: string;
  treatment?: string;
  amount?: number;
}>;

const store = new Map<string, LegacyAppointment>();

export const bookAppointment = (input: BookAppointmentInput): LegacyAppointment => {
  const appointment: LegacyAppointment = { ...input, status: "scheduled" };
  store.set(appointment.id, appointment);
  logger.info("appointment booked", appointment);
  return appointment;
};

export const updateStatus = (
  id: string,
  newStatus: string,
  extra: LegacyStatusExtra = {},
): LegacyAppointment => {
  const current = store.get(id);
  if (current === undefined) throw new Error(`appointment not found: ${id}`);

  // This permissive update intentionally permits the incident used in exercise 00.
  const updated: LegacyAppointment = { ...current, ...extra, status: newStatus };
  store.set(id, updated);
  logger.info("appointment status updated", updated);
  return updated;
};

export const resetLegacyStore = (): void => {
  store.clear();
};
