import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";

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
import { createAppointmentByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createExamResultEventStore } from "../../src/adaptor/secondary/sqlite/store/examResultEventStore.js";
import { createExaminationCompletionStore } from "../../src/adaptor/secondary/sqlite/store/examinationCompletionStore.js";
import { createFollowUpEventStore } from "../../src/adaptor/secondary/sqlite/store/followUpEventStore.js";
import { createOwnerEventStore } from "../../src/adaptor/secondary/sqlite/store/ownerEventStore.js";
import {
  createPetDeletedEventStore,
  createPetEventStore,
} from "../../src/adaptor/secondary/sqlite/store/petEventStore.js";
import { createSessionEventStore } from "../../src/adaptor/secondary/sqlite/store/sessionEventStore.js";
import { createUserEventStore } from "../../src/adaptor/secondary/sqlite/store/userEventStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import type { EventContext } from "../../src/domain/aggregate/eventContext.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { CancellationReason } from "../../src/domain/appointment/cancellationReason.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
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
import { User, type Admin, type User as UserState } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { createUserUpdated } from "../../src/domain/user/userEvent.js";
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
  otherExam: ExamId.schema.parse("00000000-0000-4000-8000-000000000011"),
  veterinarian: VeterinarianId.schema.parse("00000000-0000-4000-8000-000000000008"),
  otherAppointment: AppointmentId.schema.parse("00000000-0000-4000-8000-000000000009"),
  otherPet: PetId.schema.parse("00000000-0000-4000-8000-000000000010"),
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

const user = (name: string): Admin => ({
  kind: "Admin",
  userId: ids.user,
  email: UserEmail.schema.parse("admin@example.test"),
  name: UserName.schema.parse(name),
  passwordHash: PasswordHash.schema.parse(`scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`),
});

describe("SQLite event stores", () => {
  test("fresh migrations install an empty follow-up request claim projection", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    migrateDatabase(db);

    expect(
      db.all(sql.raw(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'follow_up_request_claims'",
      ))[0],
    ).toEqual({ name: "follow_up_request_claims" });
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([]);
  });

  test("0003 upgrades the actually recorded old 0002 schema and resumes follow-up writes", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at > 1786374000000"));
    db.run(sql.raw("DROP TABLE follow_up_request_claims"));
    db.run(sql.raw(
      "CREATE UNIQUE INDEX follow_up_requested_appointment_unique " +
      "ON domain_events (aggregate_id) WHERE event_name = 'follow-up.requested'",
    ));
    db.insert(domainEventsTable).values({
      eventId: "11000000-0000-4000-8000-000000000001",
      aggregateId: ids.appointment,
      aggregateName: "FollowUp",
      aggregateState: null,
      eventName: "follow-up.requested",
      eventPayload: { appointmentId: ids.appointment, petId: ids.pet },
      occurredAt: "2026-08-08T00:01:00.000Z",
      actorUserId: ids.actor,
    }).run();

    expect(
      db.all(sql.raw(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )),
    ).toEqual([{ created_at: 1786374000000 }]);
    expect(
      db.all(sql.raw(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'follow_up_request_claims'",
      )),
    ).toEqual([]);
    expect(
      db.all(sql.raw(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'follow_up_requested_appointment_unique'",
      )),
    ).toEqual([{ name: "follow_up_requested_appointment_unique" }]);

    migrateDatabase(db);

    expect(
      db.all(sql.raw(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'follow_up_request_claims'",
      )),
    ).toEqual([{ name: "follow_up_request_claims" }]);
    expect(
      db.all(sql.raw(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'follow_up_requested_appointment_unique'",
      )),
    ).toEqual([]);
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([
      { appointment_id: ids.appointment },
    ]);

    const result = await createFollowUpEventStore(db).store(
      FollowUpRequested.create(eventContext(32), ids.otherAppointment, ids.otherPet),
    );
    expect(result.isOk()).toBe(true);
    expect(await db.select().from(domainEventsTable)).toHaveLength(2);
  });

  test("migrating a 0001 database keeps duplicate audit ids exactly and claims once", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at >= 1786374000000"));
    db.run(sql.raw("DROP TABLE follow_up_request_claims"));
    const legacyRows = [
      "12000000-0000-4000-8000-000000000001",
      "12000000-0000-4000-8000-000000000002",
    ] as const;
    for (const eventId of legacyRows) {
      db.insert(domainEventsTable).values({
        eventId,
        aggregateId: ids.appointment,
        aggregateName: "FollowUp",
        aggregateState: null,
        eventName: "follow-up.requested",
        eventPayload: { appointmentId: ids.appointment, petId: ids.pet },
        occurredAt: "2026-08-08T00:01:00.000Z",
        actorUserId: ids.actor,
      }).run();
    }

    migrateDatabase(db);

    expect(
      db.all(sql.raw(
        "SELECT event_id FROM domain_events WHERE event_name = 'follow-up.requested' ORDER BY event_id",
      )),
    ).toEqual(legacyRows.map((eventId) => ({ event_id: eventId })));
    expect(db.all(sql.raw("SELECT appointment_id FROM follow_up_request_claims"))).toEqual([
      { appointment_id: ids.appointment },
    ]);

    const result = await createFollowUpEventStore(db).store(
      FollowUpRequested.create(eventContext(33), ids.appointment, ids.pet),
    );
    expect(result.isErr() && result.error.kind).toBe("FollowUpRequestConflict");
    expect(await db.select().from(domainEventsTable)).toHaveLength(2);
  });

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
      reason: AppointmentReason.schema.parse("persistent cough"),
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
    const appointmentRow = db.select().from(appointmentsTable).get();
    expect(JSON.stringify(appointmentRow?.state)).toContain("persistent cough");
    const resolvedAppointment = await createAppointmentByIdResolver(db).resolveById(ids.appointment);
    expect(resolvedAppointment.isOk()).toBe(true);
    expect(resolvedAppointment._unsafeUnwrap()?.reason.unwrap()).toBe("persistent cough");
    expect(JSON.stringify(resolvedAppointment._unsafeUnwrap())).not.toContain("persistent cough");
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

  test("accepts exactly one coordinated stale appointment transition", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(40))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    await store.store(booked);
    const checkedIn = Appointment.checkIn(eventContext(41))(booked.aggregateState);
    await store.store(checkedIn);
    const started = Appointment.startExamination(eventContext(42))(
      checkedIn.aggregateState,
      ids.veterinarian,
    );
    const canceled = Appointment.cancel(eventContext(43))(
      checkedIn.aggregateState,
      CancellationReason.schema.parse("private cancellation"),
    );

    const results = await Promise.all([store.store(started), store.store(canceled)]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(results.filter((result) => result.isErr())).toHaveLength(1);
    expect(results.find((result) => result.isErr())?._unsafeUnwrapErr()).toMatchObject({
      kind: "AppointmentConflict",
      appointmentId: ids.appointment,
    });
    expect(await db.select().from(appointmentsTable)).toHaveLength(1);
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });

  test("atomically records one examination completion from concurrent stale submissions", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const appointmentStore = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(10))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn(eventContext(11))(booked.aggregateState);
    const started = Appointment.startExamination(eventContext(12))(
      checkedIn.aggregateState,
      ids.veterinarian,
    );
    await appointmentStore.store(booked, checkedIn, started);
    const examinationCompletionStore = createExaminationCompletionStore(db);
    const firstResult = ExamResult.create(eventContext(13))(unwrap(ExamResult.parse({
      examId: ids.exam,
      petId: ids.pet,
      collectedAt: "2026-08-08T01:03:00.000Z",
      items: ["first private result"],
      needsFollowUp: false,
    })));
    const secondResult = ExamResult.create(eventContext(15))(unwrap(ExamResult.parse({
      examId: ids.otherExam,
      petId: ids.pet,
      collectedAt: "2026-08-08T01:05:00.000Z",
      items: ["second private result"],
      needsFollowUp: true,
    })));
    const firstCompletion = Appointment.completeExamination(eventContext(14))(
      started.aggregateState,
      { examId: ids.exam },
    );
    const secondCompletion = Appointment.completeExamination(eventContext(16))(
      started.aggregateState,
      { examId: ids.otherExam },
    );

    const results = await Promise.all([
      examinationCompletionStore.store(firstResult, firstCompletion),
      examinationCompletionStore.store(secondResult, secondCompletion),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(results.filter((result) => result.isErr())).toHaveLength(1);
    expect(results.find((result) => result.isErr())?._unsafeUnwrapErr()).toMatchObject({
      kind: "AppointmentConflict",
      appointmentId: ids.appointment,
    });
    expect(await db.select().from(examResultsTable)).toHaveLength(1);
    expect(
      (await createAppointmentByIdResolver(db).resolveById(ids.appointment))
        ._unsafeUnwrap(),
    ).toMatchObject({ kind: "AwaitingPayment" });
    expect((await db.select().from(domainEventsTable)).map(({ eventName }) => eventName)).toEqual([
      "appointment.booked",
      "appointment.checked-in",
      "appointment.examination-started",
      "exam-result.recorded",
      "appointment.examination-completed",
    ]);
  });

  test("rolls back both projections and the exam event when the completion event conflicts", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const appointmentStore = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(20))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn(eventContext(21))(booked.aggregateState);
    const started = Appointment.startExamination(eventContext(22))(
      checkedIn.aggregateState,
      ids.veterinarian,
    );
    await appointmentStore.store(booked, checkedIn, started);
    const examResult = ExamResult.create(eventContext(23))(unwrap(ExamResult.parse({
      examId: ids.exam,
      petId: ids.pet,
      collectedAt: "2026-08-08T01:13:00.000Z",
      items: ["private result"],
      needsFollowUp: false,
    })));
    const completion = Appointment.completeExamination({
      ...eventContext(24),
      eventId: started.eventId,
    })(started.aggregateState, { examId: ids.exam });

    const result = await createExaminationCompletionStore(db).store(
      examResult,
      completion,
    );

    expect(result.isErr()).toBe(true);
    expect(await db.select().from(examResultsTable)).toHaveLength(0);
    expect(
      (await createAppointmentByIdResolver(db).resolveById(ids.appointment))
        ._unsafeUnwrap(),
    ).toMatchObject({ kind: "InExamination" });
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });

  test("rejects mismatched examination events before changing either projection", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const appointmentStore = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(25))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn(eventContext(26))(booked.aggregateState);
    const started = Appointment.startExamination(eventContext(27))(
      checkedIn.aggregateState,
      ids.veterinarian,
    );
    (await appointmentStore.store(booked, checkedIn, started))._unsafeUnwrap();
    const mismatchedExamResult = ExamResult.create(eventContext(28))(
      unwrap(ExamResult.parse({
        examId: ids.otherExam,
        petId: ids.pet,
        collectedAt: "2026-08-08T01:18:00.000Z",
        items: ["private result"],
        needsFollowUp: false,
      })),
    );
    const completion = Appointment.completeExamination(eventContext(29))(
      started.aggregateState,
      { examId: ids.exam },
    );

    const result = await createExaminationCompletionStore(db).store(
      mismatchedExamResult,
      completion,
    );

    expect(result.isErr() && result.error.kind).toBe("RepositoryError");
    expect(await db.select().from(examResultsTable)).toHaveLength(0);
    expect(
      (await createAppointmentByIdResolver(db).resolveById(ids.appointment))
        ._unsafeUnwrap(),
    ).toMatchObject({ kind: "InExamination" });
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });

  test("rolls back an appointment batch when a later transition is stale", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(50))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    await store.store(booked);
    const checkedIn = Appointment.checkIn(eventContext(51))(booked.aggregateState);
    await store.store(checkedIn);
    const result = await store.store(
      Appointment.startExamination(eventContext(52))(
        checkedIn.aggregateState,
        ids.veterinarian,
      ),
      Appointment.cancel(eventContext(53))(
        checkedIn.aggregateState,
        CancellationReason.schema.parse("private cancellation"),
      ),
    );

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "AppointmentConflict" });
    expect((await createAppointmentByIdResolver(db).resolveById(ids.appointment))._unsafeUnwrap()?.kind).toBe("CheckedIn");
    expect(await db.select().from(domainEventsTable)).toHaveLength(2);
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

  test("authoritatively accepts only one of two stale last-Admin downgrades", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createUserEventStore(db);
    const firstAdmin = user("First Admin");
    const secondAdmin = {
      ...user("Second Admin"),
      userId: UserId.schema.parse("00000000-0000-4000-8000-000000000099"),
      email: UserEmail.schema.parse("second-admin@example.test"),
    } as const satisfies UserState;
    await store.store(
      User.create(eventContext(34))(firstAdmin),
      User.create(eventContext(35))(secondAdmin),
    );
    const firstDowngrade = createUserUpdated(eventContext(36), {
      ...firstAdmin,
      kind: "Receptionist",
    });
    const secondDowngrade = createUserUpdated(eventContext(37), {
      ...secondAdmin,
      kind: "Receptionist",
    });

    const results = await Promise.all([
      store.store(firstDowngrade),
      store.store(secondDowngrade),
    ]);

    expect(results.filter((result) => result.isOk())).toHaveLength(1);
    expect(results.filter((result) => result.isErr())).toHaveLength(1);
    expect(results.find((result) => result.isErr())?._unsafeUnwrapErr()).toEqual({
      kind: "CannotDowngradeLastAdmin",
    });
    const users = await db.select().from(usersTable);
    expect(users.filter(({ role }) => role === "Admin")).toHaveLength(1);
    expect(users.filter(({ role }) => role === "Receptionist")).toHaveLength(1);
    const updateHistory = (await db.select().from(domainEventsTable)).filter(
      ({ eventName }) => eventName === "user.updated",
    );
    expect(updateHistory).toHaveLength(1);
    expect(updateHistory[0]?.aggregateId).toBe(
      users.find(({ role }) => role === "Receptionist")?.userId,
    );
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

    const result = await createPetDeletedEventStore(db).store(
      Pet.delete(eventContext(22))(pet),
    );

    expect(result.isOk()).toBe(true);
    expect(await db.select().from(petsTable)).toHaveLength(0);
    const history = await db.select().from(domainEventsTable);
    expect(history.map(({ eventName }) => eventName)).toContain("pet.deleted");
  });

  test("blocks a stale pet deletion after its appointment reaches AwaitingPayment", async () => {
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
    await createOwnerEventStore(db).store(Owner.create(eventContext(38))(owner));
    const petStore = createPetEventStore(db);
    await petStore.store(Pet.create(eventContext(39))(pet));
    const staleDeletion = Pet.delete(eventContext(40))(pet);
    const booked = Appointment.book(eventContext(41))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn(eventContext(42))(
      booked.aggregateState,
    );
    const started = Appointment.startExamination(eventContext(43))(
      checkedIn.aggregateState,
      ids.veterinarian,
    );
    const awaitingPayment = Appointment.completeExamination(eventContext(44))(
      started.aggregateState,
      { examId: ids.exam },
    );
    await createAppointmentEventStore(db).store(booked, checkedIn, started);
    const examResult = ExamResult.create(eventContext(45))(
      unwrap(ExamResult.parse({
        examId: ids.exam,
        petId: ids.pet,
        collectedAt: "2026-08-08T00:45:00.000Z",
        items: ["private result"],
        needsFollowUp: false,
      })),
    );
    await createExaminationCompletionStore(db).store(
      examResult,
      awaitingPayment,
    );
    expect(
      db.select().from(appointmentsTable).get()?.status,
    ).toBe("AwaitingPayment");

    const result = await createPetDeletedEventStore(db).store(staleDeletion);

    expect(result.isErr() && result.error).toEqual({
      kind: "PetHasActiveAppointment",
      petId: ids.pet,
    });
    expect(await db.select().from(petsTable)).toHaveLength(1);
    expect(
      (await db.select().from(domainEventsTable)).filter(
        ({ eventName }) => eventName === "pet.deleted",
      ),
    ).toHaveLength(0);
  });
});
