import { z } from "zod";

import { Appointment } from "../domain/appointment.js";
import { EventId } from "../domain/event-id.js";
import { ExamResult } from "../domain/exam-result.js";
import { OwnerContact } from "../domain/owner-contact.js";
import { Timestamp } from "../domain/timestamp.js";
import { schemaResult } from "../shared/schema-result.js";

const FollowUpCandidateSchema = z.object({
  appointment: Appointment.schema,
  ownerContact: OwnerContact.schema,
  examResult: ExamResult.schema,
  eventId: EventId.schema,
  occurredAt: Timestamp.schema,
}).readonly();

export type FollowUpCandidate = z.infer<typeof FollowUpCandidateSchema>;

export const FollowUpCandidate = {
  schema: FollowUpCandidateSchema,
  matchesPet: (candidate: FollowUpCandidate) =>
    candidate.appointment.petId === candidate.examResult.petId,
  needsPhoneCall: (candidate: FollowUpCandidate) =>
    Appointment.isPaid(candidate.appointment) && candidate.examResult.needsFollowUp,
} as const;

const FollowUpCandidatesSchema = z.array(FollowUpCandidate.schema).readonly();

export const FollowUpCandidates = {
  schema: FollowUpCandidatesSchema,
  parse: schemaResult(FollowUpCandidatesSchema),
} as const;
