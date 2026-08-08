import { describe, expect, test } from "vitest";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventsTable,
  examResultsTable,
  ownersTable,
  petsTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createExamResultEventStore } from "../../src/adaptor/secondary/sqlite/store/examResultEventStore.js";
import { createFollowUpEventStore } from "../../src/adaptor/secondary/sqlite/store/followUpEventStore.js";
import { createOwnerEventStore } from "../../src/adaptor/secondary/sqlite/store/ownerEventStore.js";
import { createPetEventStore } from "../../src/adaptor/secondary/sqlite/store/petEventStore.js";
import { createSessionEventStore } from "../../src/adaptor/secondary/sqlite/store/sessionEventStore.js";
import { createUserEventStore } from "../../src/adaptor/secondary/sqlite/store/userEventStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult } from "../../src/domain/examResult/examResult.js";
import { FollowUpRequested } from "../../src/domain/followUp/followUpRequested.js";
import { Owner } from "../../src/domain/owner/owner.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { Pet } from "../../src/domain/pet/pet.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { Session } from "../../src/domain/session/session.js";
import { SessionId } from "../../src/domain/session/sessionId.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User, type User as UserState } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

const ids = {
  actor: UserId.schema.parse("00000000-0000-4000-8000-000000000001"),
  user: UserId.schema.parse("00000000-0000-4000-8000-000000000002"),
  session: SessionId.schema.parse("00000000-0000-4000-8000-000000000003"),
  owner: OwnerId.schema.parse("00000000-0000-4000-8000-000000000004"),
  pet: PetId.schema.parse("00000000-0000-4000-8000-000000000005"),
  appointment: AppointmentId.schema.parse("00000000-0000-4000-8000-000000000006"),
  exam: ExamId.schema.parse("00000000-0000-4000-8000-000000000007"),
} as const;

const eventContext = (sequence: number): EventContext => ({
  eventId: EventId.schema.parse(`10000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`),
  occurredAt: Timestamp.schema.parse(`2026-08-08T00:${sequence.toString().padStart(2, "0")}:00.000Z`),
  actorUserId: ids.actor,
});

const unwrap = <T>(result: { isOk: () => boolean; _unsafeUnwrap: () => T }): T => {
  expect(result.isOk()).toBe(true);
  return result._unsafeUnwrap();
};

const user = (name: string): UserState => ({
  kind: "Admin",
  userId: ids.user,
  email: UserEmail.schema.parse("admin@example.test"),
  name: UserName.schema.parse(name),
  passwordHash: PasswordHash.schema.parse(`scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`),
});

describe("SQLite event stores", () => {
  test("typed events update every projection and append sanitized history", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);

    const createdUser = User.create(eventContext(1))(user("Clinic Admin"));
    const session = {
      sessionId: ids.session,
      userId: ids.user,
      tokenHash: SessionTokenHash.schema.parse("a".repeat(64)),
      expiresAt: Timestamp.schema.parse("2026-08-09T00:00:00.000Z"),
    };
    const createdSession = Session.create(eventContext(2))(session);
    const owner = unwrap(Owner.parse({
      ownerId: ids.owner,
      name: "Owner Hanako",
      email: "owner@example.test",
      phone: "090-1111-2222",
    }));
    const createdOwner = Owner.create(eventContext(3))(owner);
    const pet = unwrap(Pet.parse({
      petId: ids.pet,
      ownerId: ids.owner,
      name: "Mugi",
      species: "Cat",
    }));
    const createdPet = Pet.create(eventContext(4))(pet);
    const booked = Appointment.book(eventContext(5))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: "persistent cough",
    });
    const examResult = unwrap(ExamResult.parse({
      examId: ids.exam,
      petId: ids.pet,
      collectedAt: "2026-08-08T00:06:00.000Z",
      items: ["private clinical observation"],
      needsFollowUp: true,
    }));
    const recordedExam = ExamResult.create(eventContext(6))(examResult);
    const requestedFollowUp = FollowUpRequested.create(eventContext(7), ids.appointment, ids.pet);

    await createUserEventStore(db).store(createdUser);
    await createSessionEventStore(db).store(createdSession);
    await createOwnerEventStore(db).store(createdOwner);
    await createPetEventStore(db).store(createdPet);
    await createAppointmentEventStore(db).store(booked);
    await createExamResultEventStore(db).store(recordedExam);
    await createFollowUpEventStore(db).store(requestedFollowUp);

    expect(await db.select().from(usersTable)).toHaveLength(1);
    expect(await db.select().from(sessionsTable)).toHaveLength(1);
    expect(await db.select().from(ownersTable)).toHaveLength(1);
    expect(await db.select().from(petsTable)).toHaveLength(1);
    expect(await db.select().from(appointmentsTable)).toHaveLength(1);
    expect(await db.select().from(examResultsTable)).toHaveLength(1);
    const history = await db.select().from(domainEventsTable);
    expect(history).toHaveLength(7);

    const serializedHistory = JSON.stringify(history);
    expect(serializedHistory).not.toContain("Clinic Admin");
    expect(serializedHistory).not.toContain("admin@example.test");
    expect(serializedHistory).not.toContain(createdUser.aggregateState.passwordHash.unwrap());
    expect(serializedHistory).not.toContain(createdSession.aggregateState.tokenHash.unwrap());
    expect(serializedHistory).not.toContain("Owner Hanako");
    expect(serializedHistory).not.toContain("owner@example.test");
    expect(serializedHistory).not.toContain("090-1111-2222");
    expect(serializedHistory).not.toContain("persistent cough");
    expect(serializedHistory).not.toContain("private clinical observation");
  });

  test("a duplicate event id rolls back its preceding projection update", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createUserEventStore(db);
    const created = User.create(eventContext(10))(user("Before"));
    await store.store(created);

    const duplicateContext = {
      eventId: created.eventId,
      occurredAt: Timestamp.schema.parse("2026-08-08T00:11:00.000Z"),
      actorUserId: ids.actor,
    } as const satisfies EventContext;
    const updated = User.update(duplicateContext)(created.aggregateState, {
      email: created.aggregateState.email,
      name: UserName.schema.parse("After"),
    });

    const result = await store.store(updated);

    expect(result.isErr()).toBe(true);
    expect((await db.select().from(usersTable))[0]?.name).toBe("Before");
    expect(await db.select().from(domainEventsTable)).toHaveLength(1);
  });

  test("a projection constraint failure rolls back earlier projection and event writes", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const duplicateEmail = UserEmail.schema.parse("duplicate@example.test");
    const first = User.create(eventContext(30))({
      ...user("First"),
      email: duplicateEmail,
    });
    const second = User.create(eventContext(31))({
      ...user("Second"),
      userId: UserId.schema.parse("00000000-0000-4000-8000-000000000099"),
      email: duplicateEmail,
    });

    const result = await createUserEventStore(db).store(first, second);

    expect(result.isErr()).toBe(true);
    expect(await db.select().from(usersTable)).toHaveLength(0);
    expect(await db.select().from(domainEventsTable)).toHaveLength(0);
  });

  test("a deletion event physically removes the projection and retains its history", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const owner = unwrap(Owner.parse({
      ownerId: ids.owner,
      name: "Owner Hanako",
      email: "owner@example.test",
      phone: "090-1111-2222",
    }));
    const pet = unwrap(Pet.parse({
      petId: ids.pet,
      ownerId: ids.owner,
      name: "Mugi",
      species: "Cat",
    }));
    await createOwnerEventStore(db).store(Owner.create(eventContext(20))(owner));
    const store = createPetEventStore(db);
    await store.store(Pet.create(eventContext(21))(pet));

    const result = await store.store(Pet.delete(eventContext(22))(pet));

    expect(result.isOk()).toBe(true);
    expect(await db.select().from(petsTable)).toHaveLength(0);
    const history = await db.select().from(domainEventsTable);
    expect(history.map(({ eventName }) => eventName)).toContain("pet.deleted");
  });
});
