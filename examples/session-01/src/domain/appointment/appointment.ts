export type Appointment = Readonly<{
  appointmentId: string;
  petId: string;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  scheduledAt: string;
  reason: string;
  status: string;
  checkedInAt?: string;
  veterinarianId?: string;
  examinationStartedAt?: string;
  examId?: string;
  examinationCompletedAt?: string;
  diagnosis?: unknown;
  treatment?: unknown;
  amount?: unknown;
  paidAt?: string;
  cancelReason?: string;
}>;

export type AppointmentExtra = Partial<Omit<Appointment, "appointmentId">>;

export type BookAppointmentInput = Omit<Appointment, "status">;

export const bookAppointment = (input: BookAppointmentInput): Appointment => ({
  ...input,
  status: "scheduled",
});

export const updateStatus = (
  appointment: Appointment,
  status: string,
  extra?: AppointmentExtra,
): Appointment => ({ ...appointment, ...extra, status });
