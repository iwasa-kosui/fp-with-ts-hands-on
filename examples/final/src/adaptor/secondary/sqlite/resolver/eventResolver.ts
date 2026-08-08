import { asc } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { AnyDomainEvent } from "../../../../domain/aggregate/domainEvent.js";
import type { DomainEventResolver } from "../../../../domain/aggregate/domainEventResolver.js";
import { EventId } from "../../../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { UserId } from "../../../../domain/user/userId.js";
import type { SqliteDatabase } from "../db.js";
import { domainEventsTable } from "../schema.js";

const EventRowSchema = z.object({
  eventId: EventId.schema,
  aggregateId: z.string().min(1),
  aggregateName: z.string().min(1),
  aggregateState: z.unknown().nullable(),
  eventName: z.string().min(1),
  eventPayload: z.record(z.unknown()),
  occurredAt: Timestamp.schema,
  actorUserId: UserId.schema,
});

const eventKind = (eventName: string): string => {
  const names: Readonly<Record<string, string>> = {
    "user.created": "UserCreated",
    "user.updated": "UserUpdated",
    "user.password-reset": "UserPasswordReset",
    "user.deleted": "UserDeleted",
    "session.created": "SessionCreated",
    "session.deleted": "SessionDeleted",
    "owner.created": "OwnerCreated",
    "owner.updated": "OwnerUpdated",
    "owner.deleted": "OwnerDeleted",
    "pet.created": "PetCreated",
    "pet.updated": "PetUpdated",
    "pet.deleted": "PetDeleted",
    "appointment.booked": "AppointmentBooked",
    "appointment.checked-in": "AppointmentCheckedIn",
    "appointment.examination-started": "ExaminationStarted",
    "appointment.payment-recorded": "PaymentRecorded",
    "appointment.canceled": "AppointmentCanceled",
    "exam-result.recorded": "ExamResultRecorded",
    "exam-result.updated": "ExamResultUpdated",
    "exam-result.deleted": "ExamResultDeleted",
    "follow-up.requested": "FollowUpRequested",
  };
  const kind = names[eventName];
  if (kind === undefined) {
    throw new TypeError(`Unsupported domain event name: ${eventName}`);
  }
  return kind;
};

const parseRow = (raw: typeof domainEventsTable.$inferSelect): AnyDomainEvent => {
  const row = EventRowSchema.parse(raw);
  return {
    kind: eventKind(row.eventName),
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

export const createEventResolver = (db: SqliteDatabase): DomainEventResolver => ({
  resolveAll: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.select().from(domainEventsTable).orderBy(asc(domainEventsTable.occurredAt)).all().map(parseRow),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "EventResolver.resolveAll",
        cause,
      }),
    ),
});
