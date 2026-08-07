import { OwnerContact } from "../src/boundary/owner-contact.js";
import { Appointment } from "../src/domain/appointment.js";
import { AppointmentId } from "../src/domain/appointment-id.js";
import { OwnerId } from "../src/domain/owner-id.js";
import { PetId } from "../src/domain/pet-id.js";
import { Timestamp } from "../src/domain/timestamp.js";
import { VeterinarianId } from "../src/domain/veterinarian-id.js";

const appointmentId = AppointmentId.parse("11111111-1111-4111-8111-111111111111")._unsafeUnwrap();
const petId = PetId.parse("22222222-2222-4222-8222-222222222222")._unsafeUnwrap();
const ownerId = OwnerId.parse("33333333-3333-4333-8333-333333333333")._unsafeUnwrap();
const veterinarianId = VeterinarianId.parse("44444444-4444-4444-8444-444444444444")._unsafeUnwrap();
const scheduledAt = Timestamp.parse("2026-08-30T06:00:00.000Z")._unsafeUnwrap();
const checkedInAt = Timestamp.parse("2026-08-30T06:20:00.000Z")._unsafeUnwrap();
const startedAt = Timestamp.parse("2026-08-30T06:30:00.000Z")._unsafeUnwrap();
const paidAt = Timestamp.parse("2026-08-30T07:00:00.000Z")._unsafeUnwrap();

const scheduled = Appointment.book({
  appointmentId,
  petId,
  ownerId,
  scheduledAt,
  reason: "skin check",
});

export const checkedIn = Appointment.checkIn(scheduled, checkedInAt);

const examining = Appointment.startExamination(checkedIn, veterinarianId, startedAt);

export const paidAppointment = Appointment.recordPayment(
  examining,
  { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
  paidAt,
);

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
