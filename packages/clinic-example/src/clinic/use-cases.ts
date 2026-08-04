import { z } from "zod";
import { err, ok, type Result } from "../shared/result.js";
import { schemaResult, type ValidationError } from "../shared/schema-result.js";
import { Appointment, type Appointment as AppointmentValue, type CheckedIn, type InExamination } from "./appointment.js";
import { AppointmentId, type AppointmentId as AppointmentIdValue } from "./appointment-id.js";
import type { AppointmentRepository } from "./appointment-repository.js";
import type { DomainEventStore } from "./domain-event-store.js";
import { ExaminationStarted, FollowUpRequested } from "./domain-events.js";
import { ExamResult } from "./exam-result.js";
import type { PetId as PetIdValue } from "./pet-id.js";
import type { OwnerContact } from "./owner-contact.js";
import { VeterinarianId, type VeterinarianId as VeterinarianIdValue } from "./veterinarian-id.js";
import type { Sensitive } from "../shared/sensitive.js";

export type AppointmentNotFound = Readonly<{ kind: "AppointmentNotFound"; appointmentId: AppointmentIdValue }>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  expected: "CheckedIn";
  actual: AppointmentValue["kind"];
}>;
export type StartExaminationError = AppointmentNotFound | InvalidAppointmentState | ValidationError;

export type StartExaminationInput = Readonly<{
  appointmentId: unknown;
  veterinarianId: unknown;
  eventId: string;
  occurredAt: string;
  eventStore: DomainEventStore;
}>;

const StartExaminationSchema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
});
type StartExaminationIds = Readonly<{ appointmentId: AppointmentIdValue; veterinarianId: VeterinarianIdValue }>;

export const ensureFound = (appointment: AppointmentValue | undefined, appointmentId: AppointmentIdValue): Result<AppointmentValue, AppointmentNotFound> =>
  appointment === undefined ? err({ kind: "AppointmentNotFound", appointmentId }) : ok(appointment);

export const ensureCheckedIn = (appointment: AppointmentValue): Result<CheckedIn, InvalidAppointmentState> =>
  appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({ kind: "InvalidAppointmentState", expected: "CheckedIn", actual: appointment.kind });

export const startExaminationUseCase = (
  repo: AppointmentRepository,
  input: StartExaminationInput,
): Result<InExamination, StartExaminationError> => {
  const parsed = schemaResult<StartExaminationIds>(StartExaminationSchema)({
    appointmentId: input.appointmentId,
    veterinarianId: input.veterinarianId,
  });
  if (parsed.kind === "Err") return parsed;

  const found = ensureFound(repo.findById(parsed.value.appointmentId), parsed.value.appointmentId);
  if (found.kind === "Err") return found;
  const checkedIn = ensureCheckedIn(found.value);
  if (checkedIn.kind === "Err") return checkedIn;

  const started = Appointment.startExamination(
    checkedIn.value,
    parsed.value.veterinarianId,
    input.occurredAt,
  );
  repo.save(started);
  input.eventStore.append(ExaminationStarted.create({
    eventId: input.eventId,
    occurredAt: input.occurredAt,
    appointmentId: started.id,
    veterinarianId: started.veterinarianId,
  }));
  return ok(started);
};

export type FollowUpTarget = Readonly<{
  appointmentId: AppointmentIdValue;
  ownerPhone: Sensitive<string>;
}>;

export type FollowUpCandidate = Readonly<{
  appointment: AppointmentValue;
  examResult: unknown;
  ownerContact: OwnerContact;
}>;

export type FollowUpExamResult = Readonly<{
  examId: string;
  petId: PetIdValue;
  collectedAt: string;
  needsFollowUp: boolean;
}>;

export type ExamResultPetMismatch = Readonly<{
  kind: "ExamResultPetMismatch";
  appointmentId: AppointmentIdValue;
  expectedPetId: PetIdValue;
  actualPetId: PetIdValue;
}>;

export type FollowUpTargetError = ValidationError | ExamResultPetMismatch;

export type CollectFollowUpTargetsInput = Readonly<{
  candidates: ReadonlyArray<FollowUpCandidate>;
  eventStore: DomainEventStore;
}>;

const FollowUpExamResultSchema = ExamResult.schema
  .pick({
    examId: true,
    petId: true,
    collectedAt: true,
    needsFollowUp: true,
  })
  .partial({ needsFollowUp: true })
  .transform((value) => ({
    ...value,
    needsFollowUp: value.needsFollowUp ?? false,
  }));

const parseFollowUpExamResult = schemaResult<FollowUpExamResult>(FollowUpExamResultSchema);

// This deliberately incomplete exercise is implemented by participants in module 05.
export const collectFollowUpTargets = (
  _input: CollectFollowUpTargetsInput,
): Result<ReadonlyArray<FollowUpTarget>, FollowUpTargetError> =>
  err({ kind: "FollowUpTargetNotImplemented" });
