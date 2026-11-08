import type { ExamResultPetMismatch } from "../domain/followUp/collectFollowUpTargets.js";

export const rejectExamResultPetMismatch = (
  mismatch: ExamResultPetMismatch,
): never => {
  throw new TypeError(
    `Corrupt follow-up candidate: appointment ${mismatch.appointmentId} expects pet ${mismatch.expectedPetId} but its exam result has pet ${mismatch.actualPetId}`,
  );
};
