import type { Appointment } from "../appointment/index.js";
import type { ExamResult } from "../examResult/index.js";
import type { Owner } from "../owner/index.js";

export type FollowUpCandidate = Readonly<{
  appointment: Appointment;
  owner: Owner;
  examResult: ExamResult;
}>;

export const FollowUpCandidate = {
  matchesPet: (candidate: FollowUpCandidate) => candidate.appointment.petId === candidate.examResult.petId,
  needsPhoneCall: (candidate: FollowUpCandidate) =>
    candidate.appointment.kind === "Paid" && candidate.examResult.needsFollowUp,
} as const;
