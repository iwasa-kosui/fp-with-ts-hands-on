export type CancellationReason = string;

export type Scheduled = Readonly<{
  kind: "Scheduled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
}>;

export type CheckedIn = Readonly<{
  kind: "CheckedIn";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
}>;

export type InExamination = Readonly<{
  kind: "InExamination";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
  veterinarianId: string;
  examinationStartedAt: string;
}>;

export type Paid = Readonly<{
  kind: "Paid";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: string;
  checkedInAt: string;
  veterinarianId: string;
  examinationStartedAt: string;
  diagnosis: string;
  treatment: string;
  amount: number;
  paidAt: string;
}>;

export type Canceled = Readonly<{
  kind: "Canceled";
  appointmentId: string;
  petId: string;
  ownerId: string;
  scheduledAt: string;
  reason: CancellationReason;
  canceledAt: string;
}>;

export type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled;

export type RecordPaymentInput = Readonly<{
  diagnosis: string;
  treatment: string;
  amount: number;
}>;
