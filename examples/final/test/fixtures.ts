import { OwnerContact } from "../src/domain/owner-contact.js";
import type {
  CheckedIn,
  InExamination,
  Paid,
  Scheduled,
} from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { EventId } from "../src/domain/event-id.js";
import { ExamId } from "../src/domain/exam-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";

export const appointmentId = AppointmentId.parse(
  "11111111-1111-4111-8111-111111111111",
)._unsafeUnwrap();
export const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
export const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
export const veterinarianId = VeterinarianId.parse(
  "44444444-4444-4444-8444-444444444444",
)._unsafeUnwrap();
export const examId = ExamId.parse("77777777-7777-4777-8777-777777777777")._unsafeUnwrap();
export const eventId = EventId.parse("66666666-6666-4666-8666-666666666666")._unsafeUnwrap();
export const scheduledAt = Timestamp.parse("2026-08-30T06:00:00.000Z")._unsafeUnwrap();
export const checkedInAt = Timestamp.parse("2026-08-30T06:20:00.000Z")._unsafeUnwrap();
export const startedAt = Timestamp.parse("2026-08-30T06:30:00.000Z")._unsafeUnwrap();
export const collectedAt = Timestamp.parse("2026-08-30T06:50:00.000Z")._unsafeUnwrap();
export const paidAt = Timestamp.parse("2026-08-30T07:00:00.000Z")._unsafeUnwrap();

const scheduled = {
  kind: "Scheduled",
  appointmentId,
  petId,
  ownerId,
  scheduledAt,
  reason: "skin check",
} as const satisfies Scheduled;

export const checkedIn = {
  ...scheduled,
  kind: "CheckedIn",
  checkedInAt,
} as const satisfies CheckedIn;

const examining = {
  ...checkedIn,
  kind: "InExamination",
  veterinarianId,
  examinationStartedAt: startedAt,
} as const satisfies InExamination;

export const paidAppointment = {
  ...examining,
  kind: "Paid",
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
  paidAt,
} as const satisfies Paid;

export const ownerContact = OwnerContact.parse({
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
})._unsafeUnwrap();

export const validRawInput = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  veterinarianId: "44444444-4444-4444-8444-444444444444",
  eventId: "66666666-6666-4666-8666-666666666666",
  occurredAt: "2026-08-30T06:30:00.000Z",
} as const;

export const validRawCandidate = {
  appointment: paidAppointment,
  ownerContact: {
    ownerName: "Owner A",
    ownerEmail: "owner@example.test",
    ownerPhone: "090-0000-0000",
  },
  examResult: {
    examId: "77777777-7777-4777-8777-777777777777",
    petId: "22222222-2222-4222-8222-222222222222",
    collectedAt: "2026-08-30T06:50:00.000Z",
    needsFollowUp: true,
    items: ["skin scraping"],
  },
  eventId: "66666666-6666-4666-8666-666666666666",
  occurredAt: "2026-08-30T07:00:00.000Z",
} as const;
