import { z } from "zod";

import { AppointmentId, VeterinarianId } from "../../../domain/appointment/index.js";
import type { Appointment } from "../../../domain/appointment/index.js";
import { ExamId } from "../../../domain/examResult/index.js";
import { OwnerId } from "../../../domain/owner/index.js";
import { PetId } from "../../../domain/pet/index.js";

const appointmentBase = {
  appointmentId: AppointmentId.schema,
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  scheduledAt: z.string(),
  reason: z.string(),
} as const;

const scheduled = z.object({
  ...appointmentBase,
  kind: z.literal("Scheduled"),
});

const checkedIn = z.object({
  ...appointmentBase,
  kind: z.literal("CheckedIn"),
  checkedInAt: z.string(),
});

const inExamination = z.object({
  ...appointmentBase,
  kind: z.literal("InExamination"),
  checkedInAt: z.string(),
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: z.string(),
});

const awaitingPayment = z.object({
  ...appointmentBase,
  kind: z.literal("AwaitingPayment"),
  checkedInAt: z.string(),
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: z.string(),
  examId: ExamId.schema,
  examinationCompletedAt: z.string(),
});

const paid = z.object({
  ...appointmentBase,
  kind: z.literal("Paid"),
  checkedInAt: z.string(),
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: z.string(),
  examId: ExamId.schema,
  examinationCompletedAt: z.string(),
  diagnosis: z.string(),
  treatment: z.string(),
  amount: z.number(),
  paidAt: z.string(),
});

const canceled = z.object({
  ...appointmentBase,
  kind: z.literal("Canceled"),
  canceledAt: z.string(),
});

const appointmentSchema = z.discriminatedUnion("kind", [
  scheduled,
  checkedIn,
  inExamination,
  awaitingPayment,
  paid,
  canceled,
]);

const persistedJson = z.string().transform((state, context) => {
  try {
    return JSON.parse(state);
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Persisted appointment state is not valid JSON",
    });
    return z.NEVER;
  }
});

export const persistedAppointmentSchema = persistedJson.pipe(appointmentSchema);

export const parsePersistedAppointment = (state: unknown): Appointment =>
  persistedAppointmentSchema.parse(state);
