import { asc } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { EventId } from "../../../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { PaymentAmount } from "../../../../domain/appointment/paymentAmount.js";
import { VeterinarianId } from "../../../../domain/appointment/veterinarianId.js";
import { ExamId } from "../../../../domain/examResult/examId.js";
import { OwnerId } from "../../../../domain/owner/ownerId.js";
import { PetId } from "../../../../domain/pet/petId.js";
import { SessionId } from "../../../../domain/session/sessionId.js";
import { UserId } from "../../../../domain/user/userId.js";
import type {
  EventHistoryEntry,
  EventHistoryReader,
} from "../../../../useCase/query/eventHistoryReader.js";
import type { SqliteDatabase } from "../db.js";
import { domainEventsTable } from "../schema.js";

const EventIdentitySchema = z.object({
  eventId: EventId.schema,
  occurredAt: Timestamp.schema,
  actorUserId: UserId.schema,
});
const UserRoleSchema = z.enum(["Admin", "Receptionist", "Veterinarian"]);
const UserSafeStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Admin"), userId: UserId.schema }).strict(),
  z.object({ kind: z.literal("Receptionist"), userId: UserId.schema }).strict(),
  z.object({
    kind: z.literal("Veterinarian"),
    userId: UserId.schema,
    veterinarianId: VeterinarianId.schema,
  }).strict(),
]);
const SessionSafeStateSchema = z.object({
  sessionId: SessionId.schema,
  userId: UserId.schema,
  expiresAt: Timestamp.schema,
}).strict();
const OwnerSafeStateSchema = z.object({ ownerId: OwnerId.schema }).strict();
const PetSafeStateSchema = z.object({
  petId: PetId.schema,
  ownerId: OwnerId.schema,
  species: z.string().trim().min(1).max(100),
}).strict();
const AppointmentSafeBaseShape = {
  appointmentId: AppointmentId.schema,
  ownerId: OwnerId.schema,
  petId: PetId.schema,
  scheduledAt: Timestamp.schema,
};
const ScheduledSafeStateSchema = z.object({
  kind: z.literal("Scheduled"),
  ...AppointmentSafeBaseShape,
}).strict();
const CheckedInSafeStateSchema = z.object({
  kind: z.literal("CheckedIn"),
  ...AppointmentSafeBaseShape,
  checkedInAt: Timestamp.schema,
}).strict();
const InExaminationSafeStateSchema = z.object({
  kind: z.literal("InExamination"),
  ...AppointmentSafeBaseShape,
  checkedInAt: Timestamp.schema,
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: Timestamp.schema,
}).strict();
const PaidSafeStateSchema = z.object({
  kind: z.literal("Paid"),
  ...AppointmentSafeBaseShape,
  checkedInAt: Timestamp.schema,
  veterinarianId: VeterinarianId.schema,
  examinationStartedAt: Timestamp.schema,
  amount: PaymentAmount.schema,
  paidAt: Timestamp.schema,
}).strict();
const CanceledSafeStateSchema = z.object({
  kind: z.literal("Canceled"),
  ...AppointmentSafeBaseShape,
  canceledAt: Timestamp.schema,
}).strict();
const ExamResultSafeStateSchema = z.object({
  examId: ExamId.schema,
  petId: PetId.schema,
  collectedAt: Timestamp.schema,
  needsFollowUp: z.boolean(),
}).strict();

const userEvent = <TEventName extends "user.created" | "user.updated">(eventName: TEventName) => EventIdentitySchema.extend({
  aggregateId: UserId.schema,
  aggregateName: z.literal("User"),
  aggregateState: UserSafeStateSchema,
  eventName: z.literal(eventName),
  eventPayload: z.object({ userId: UserId.schema, role: UserRoleSchema }).strict(),
}).strict();
const userPasswordResetEvent = EventIdentitySchema.extend({
  aggregateId: UserId.schema,
  aggregateName: z.literal("User"),
  aggregateState: UserSafeStateSchema,
  eventName: z.literal("user.password-reset"),
  eventPayload: z.object({ userId: UserId.schema }).strict(),
}).strict();
const userDeletedEvent = EventIdentitySchema.extend({
  aggregateId: UserId.schema,
  aggregateName: z.literal("User"),
  aggregateState: z.null(),
  eventName: z.literal("user.deleted"),
  eventPayload: z.object({ userId: UserId.schema }).strict(),
}).strict();
const sessionCreatedEvent = EventIdentitySchema.extend({
  aggregateId: SessionId.schema,
  aggregateName: z.literal("Session"),
  aggregateState: SessionSafeStateSchema,
  eventName: z.literal("session.created"),
  eventPayload: z.object({ sessionId: SessionId.schema, userId: UserId.schema }).strict(),
}).strict();
const sessionDeletedEvent = EventIdentitySchema.extend({
  aggregateId: SessionId.schema,
  aggregateName: z.literal("Session"),
  aggregateState: z.null(),
  eventName: z.literal("session.deleted"),
  eventPayload: z.object({ sessionId: SessionId.schema, userId: UserId.schema }).strict(),
}).strict();
const ownerEvent = <TEventName extends "owner.created" | "owner.updated">(eventName: TEventName) =>
  EventIdentitySchema.extend({
    aggregateId: OwnerId.schema,
    aggregateName: z.literal("Owner"),
    aggregateState: OwnerSafeStateSchema,
    eventName: z.literal(eventName),
    eventPayload: z.object({ ownerId: OwnerId.schema }).strict(),
  }).strict();
const ownerDeletedEvent = EventIdentitySchema.extend({
  aggregateId: OwnerId.schema,
  aggregateName: z.literal("Owner"),
  aggregateState: z.null(),
  eventName: z.literal("owner.deleted"),
  eventPayload: z.object({ ownerId: OwnerId.schema }).strict(),
}).strict();
const petEvent = <TEventName extends "pet.created" | "pet.updated">(eventName: TEventName) =>
  EventIdentitySchema.extend({
    aggregateId: PetId.schema,
    aggregateName: z.literal("Pet"),
    aggregateState: PetSafeStateSchema,
    eventName: z.literal(eventName),
    eventPayload: z.object({ petId: PetId.schema, ownerId: OwnerId.schema }).strict(),
  }).strict();
const petDeletedEvent = EventIdentitySchema.extend({
  aggregateId: PetId.schema,
  aggregateName: z.literal("Pet"),
  aggregateState: z.null(),
  eventName: z.literal("pet.deleted"),
  eventPayload: z.object({ petId: PetId.schema, ownerId: OwnerId.schema }).strict(),
}).strict();
const appointmentEvent = <TEventName extends string, TState extends z.ZodTypeAny>(
  eventName: TEventName,
  aggregateState: TState,
) => EventIdentitySchema.extend({
  aggregateId: AppointmentId.schema,
  aggregateName: z.literal("Appointment"),
  aggregateState,
  eventName: z.literal(eventName),
  eventPayload: z.object({ appointmentId: AppointmentId.schema }).strict(),
}).strict();
const examinationStartedEvent = EventIdentitySchema.extend({
  aggregateId: AppointmentId.schema,
  aggregateName: z.literal("Appointment"),
  aggregateState: InExaminationSafeStateSchema,
  eventName: z.literal("appointment.examination-started"),
  eventPayload: z.object({
    appointmentId: AppointmentId.schema,
    veterinarianId: VeterinarianId.schema,
  }).strict(),
}).strict();
const examResultEvent = <TEventName extends "exam-result.recorded" | "exam-result.updated">(
  eventName: TEventName,
) => EventIdentitySchema.extend({
  aggregateId: ExamId.schema,
  aggregateName: z.literal("ExamResult"),
  aggregateState: ExamResultSafeStateSchema,
  eventName: z.literal(eventName),
  eventPayload: z.object({ examId: ExamId.schema, petId: PetId.schema }).strict(),
}).strict();
const examResultDeletedEvent = EventIdentitySchema.extend({
  aggregateId: ExamId.schema,
  aggregateName: z.literal("ExamResult"),
  aggregateState: z.null(),
  eventName: z.literal("exam-result.deleted"),
  eventPayload: z.object({ examId: ExamId.schema, petId: PetId.schema }).strict(),
}).strict();

const EventRowSchema = z.discriminatedUnion("eventName", [
  userEvent("user.created"),
  userEvent("user.updated"),
  userPasswordResetEvent,
  userDeletedEvent,
  sessionCreatedEvent,
  sessionDeletedEvent,
  ownerEvent("owner.created"),
  ownerEvent("owner.updated"),
  ownerDeletedEvent,
  petEvent("pet.created"),
  petEvent("pet.updated"),
  petDeletedEvent,
  appointmentEvent("appointment.booked", ScheduledSafeStateSchema),
  appointmentEvent("appointment.checked-in", CheckedInSafeStateSchema),
  examinationStartedEvent,
  appointmentEvent("appointment.payment-recorded", PaidSafeStateSchema),
  appointmentEvent("appointment.canceled", CanceledSafeStateSchema),
  examResultEvent("exam-result.recorded"),
  examResultEvent("exam-result.updated"),
  examResultDeletedEvent,
  EventIdentitySchema.extend({
    aggregateId: AppointmentId.schema,
    aggregateName: z.literal("FollowUp"),
    aggregateState: z.null(),
    eventName: z.literal("follow-up.requested"),
    eventPayload: z.object({
      appointmentId: AppointmentId.schema,
      petId: PetId.schema,
    }).strict(),
  }).strict(),
]);

type EventRow = z.infer<typeof EventRowSchema>;

const ensureSame = (...identifiers: readonly string[]): void => {
  if (identifiers.some((identifier) => identifier !== identifiers[0])) {
    throw new TypeError("Corrupt domain event record");
  }
};

const validateConsistency = (row: EventRow): void => {
  switch (row.eventName) {
    case "user.created":
    case "user.updated":
      ensureSame(row.aggregateId, row.aggregateState.userId, row.eventPayload.userId);
      if (row.aggregateState.kind !== row.eventPayload.role) {
        throw new TypeError("Corrupt domain event record");
      }
      return;
    case "user.password-reset":
      ensureSame(row.aggregateId, row.aggregateState.userId, row.eventPayload.userId);
      return;
    case "user.deleted":
      ensureSame(row.aggregateId, row.eventPayload.userId);
      return;
    case "session.created":
      ensureSame(row.aggregateId, row.aggregateState.sessionId, row.eventPayload.sessionId);
      ensureSame(row.aggregateState.userId, row.eventPayload.userId);
      return;
    case "session.deleted":
      ensureSame(row.aggregateId, row.eventPayload.sessionId);
      return;
    case "owner.created":
    case "owner.updated":
      ensureSame(row.aggregateId, row.aggregateState.ownerId, row.eventPayload.ownerId);
      return;
    case "owner.deleted":
      ensureSame(row.aggregateId, row.eventPayload.ownerId);
      return;
    case "pet.created":
    case "pet.updated":
      ensureSame(row.aggregateId, row.aggregateState.petId, row.eventPayload.petId);
      ensureSame(row.aggregateState.ownerId, row.eventPayload.ownerId);
      return;
    case "pet.deleted":
      ensureSame(row.aggregateId, row.eventPayload.petId);
      return;
    case "appointment.booked":
    case "appointment.checked-in":
    case "appointment.payment-recorded":
    case "appointment.canceled":
      ensureSame(row.aggregateId, row.aggregateState.appointmentId, row.eventPayload.appointmentId);
      return;
    case "appointment.examination-started":
      ensureSame(row.aggregateId, row.aggregateState.appointmentId, row.eventPayload.appointmentId);
      ensureSame(row.aggregateState.veterinarianId, row.eventPayload.veterinarianId);
      return;
    case "exam-result.recorded":
    case "exam-result.updated":
      ensureSame(row.aggregateId, row.aggregateState.examId, row.eventPayload.examId);
      ensureSame(row.aggregateState.petId, row.eventPayload.petId);
      return;
    case "exam-result.deleted":
      ensureSame(row.aggregateId, row.eventPayload.examId);
      return;
    case "follow-up.requested":
      ensureSame(row.aggregateId, row.eventPayload.appointmentId);
      return;
    default:
      row satisfies never;
  }
};

const parseRow = (
  raw: typeof domainEventsTable.$inferSelect,
): EventHistoryEntry => {
  const row = EventRowSchema.parse(raw);
  validateConsistency(row);
  return {
    eventId: row.eventId,
    aggregateId: row.aggregateId,
    aggregateName: row.aggregateName,
    aggregateState: row.aggregateState ?? undefined,
    eventName: row.eventName,
    eventPayload: row.eventPayload,
    occurredAt: row.occurredAt,
    actorUserId: row.actorUserId,
  };
};

export const createEventHistoryReader = (
  db: SqliteDatabase,
): EventHistoryReader => ({
  list: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select()
          .from(domainEventsTable)
          .orderBy(asc(domainEventsTable.occurredAt))
          .all()
          .map(parseRow),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "EventHistoryReader.list",
        cause,
      }),
    ),
});
