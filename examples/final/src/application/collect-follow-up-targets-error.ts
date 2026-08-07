import type { AppointmentId } from "../domain/appointment-id.js";
import type { PetId } from "../domain/pet-id.js";
import type { ValidationError } from "../shared/schema-result.js";

export type ExamResultPetMismatch = Readonly<{
  kind: "ExamResultPetMismatch";
  appointmentId: AppointmentId;
  expectedPetId: PetId;
  actualPetId: PetId;
}>;

export type CollectFollowUpTargetsError = ValidationError | ExamResultPetMismatch;
