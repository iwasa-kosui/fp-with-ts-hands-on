import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
  domainEventsTable,
  examResultsTable,
  ownersTable,
  petsTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { classifyPayloadSensitivity } from "../../src/adaptor/secondary/sqlite/eventPersistence.js";
import {
  toAuditJsonValue,
  toEventRecord,
} from "../../src/adaptor/secondary/sqlite/eventRecord.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createAppointmentByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createExamResultEventStore } from "../../src/adaptor/secondary/sqlite/store/examResultEventStore.js";
import { createExaminationCompletionStore } from "../../src/adaptor/secondary/sqlite/store/examinationCompletionStore.js";
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
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { AppointmentDuration } from "../../src/domain/appointment/appointmentDuration.js";
import { ServiceCode } from "../../src/domain/appointment/serviceCode.js";
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
import { Sensitive } from "../../src/domain/shared/sensitive.js";

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

const eventWithRuntimePayload = (payload: unknown) => {
  const event = User.create(eventContext(38))(user("Audit Admin"));
  if (!Reflect.set(event, "eventPayload", payload)) {
    throw new TypeError("test event payload replacement failed");
  }
  return event;
};

const appendOnlyTriggerNames = [
  "domain_event_payloads_append_only_delete",
  "domain_event_payloads_append_only_update",
  "domain_event_sensitive_payloads_append_only_delete",
  "domain_event_sensitive_payloads_append_only_update",
  "domain_events_append_only_delete",
  "domain_events_append_only_update",
] as const;

const aee8145AppendOnlyTriggerTargets = [
  ["domain_events", "UPDATE"],
  ["domain_events", "DELETE"],
  ["domain_event_payloads", "UPDATE"],
  ["domain_event_payloads", "DELETE"],
  ["domain_event_sensitive_payloads", "UPDATE"],
  ["domain_event_sensitive_payloads", "DELETE"],
] as const;

const expectAppendOnlyTriggers = (db: ReturnType<typeof createSqliteDatabase>): void => {
  expect(db.all(sql.raw(`
    SELECT name FROM sqlite_master
    WHERE type = 'trigger' AND name LIKE '%_append_only_%'
    ORDER BY name
  `))).toEqual(appendOnlyTriggerNames.map((name) => ({ name })));
};

const restoreBase0004AppliedDatabase = (
  db: ReturnType<typeof createSqliteDatabase>,
): void => {
  migrateDatabase(db);
  for (const triggerName of appendOnlyTriggerNames) {
    db.run(sql.raw(`DROP TRIGGER IF EXISTS ${triggerName}`));
  }
  db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at > 1786546800000"));
};

const restoreAee8145AppliedDatabase = (
  db: ReturnType<typeof createSqliteDatabase>,
): void => {
  restoreBase0004AppliedDatabase(db);
  for (const [tableName, operation] of aee8145AppendOnlyTriggerTargets) {
    const triggerName = `${tableName}_append_only_${operation.toLowerCase()}`;
    db.run(sql.raw(`
      CREATE TRIGGER ${triggerName}
      BEFORE ${operation} ON ${tableName}
      BEGIN
        SELECT RAISE(ABORT, '${tableName} is append-only');
      END
    `));
  }
};

const restoreLegacyAuditSchema = (db: ReturnType<typeof createSqliteDatabase>): void => {
  db.run(sql.raw("DROP TRIGGER IF EXISTS domain_event_payloads_classification"));
  db.run(sql.raw("DROP TRIGGER IF EXISTS domain_event_sensitive_payloads_classification"));
  db.run(sql.raw("DROP TABLE IF EXISTS domain_event_payloads"));
  db.run(sql.raw("DROP TABLE IF EXISTS domain_event_sensitive_payloads"));
  db.run(sql.raw("DROP TABLE domain_events"));
  db.run(sql.raw(`
    CREATE TABLE domain_events (
      event_id text PRIMARY KEY NOT NULL,
      aggregate_id text NOT NULL,
      aggregate_name text NOT NULL,
      aggregate_state text,
      event_name text NOT NULL,
      event_payload text NOT NULL,
      occurred_at text NOT NULL,
      actor_user_id text NOT NULL
    )
  `));
  db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at > 1786460400000"));
};

const auditTablesSnapshot = (db: ReturnType<typeof createSqliteDatabase>) => ({
  metadata: db.select().from(domainEventsTable).all(),
  regular: db.select().from(domainEventPayloadsTable).all(),
  sensitive: db.select().from(domainEventSensitivePayloadsTable).all(),
});

const insertAppendOnlyAuditFixture = (db: ReturnType<typeof createSqliteDatabase>) => {
  const regularEventId = "15000000-0000-4000-8000-000000000001";
  const sensitiveEventId = "15000000-0000-4000-8000-000000000002";
  db.insert(domainEventsTable).values([
    {
      eventId: regularEventId,
      aggregateId: ids.appointment,
      aggregateName: "AuditFixture",
      eventName: "audit.regular-fixture",
      occurredAt: "2026-08-08T00:01:00.000Z",
      actorUserId: ids.actor,
      payloadSensitivity: "Regular",
    },
    {
      eventId: sensitiveEventId,
      aggregateId: ids.owner,
      aggregateName: "Owner",
      eventName: "owner.updated",
      occurredAt: "2026-08-08T00:02:00.000Z",
      actorUserId: ids.actor,
      payloadSensitivity: "Sensitive",
    },
  ]).run();
  db.insert(domainEventPayloadsTable).values({
    eventId: regularEventId,
    aggregateState: { kind: "Regular" },
    eventPayload: { fact: "regular fact" },
  }).run();
  db.insert(domainEventSensitivePayloadsTable).values({
    eventId: sensitiveEventId,
    aggregateState: { email: "owner@example.test" },
    eventPayload: { reason: "private reason" },
  }).run();
  return { regularEventId, sensitiveEventId };
};

const expectAuditRowsAppendOnly = (
  db: ReturnType<typeof createSqliteDatabase>,
  eventIds: ReturnType<typeof insertAppendOnlyAuditFixture>,
  before: ReturnType<typeof auditTablesSnapshot>,
): void => {
  const mutations = [
    sql`UPDATE domain_events SET payload_sensitivity = ${"Sensitive"} WHERE event_id = ${eventIds.regularEventId}`,
    sql`DELETE FROM domain_events WHERE event_id = ${eventIds.regularEventId}`,
    sql`UPDATE domain_event_payloads SET event_id = ${eventIds.sensitiveEventId} WHERE event_id = ${eventIds.regularEventId}`,
    sql`UPDATE domain_event_payloads SET event_payload = ${JSON.stringify({ fact: "changed" })} WHERE event_id = ${eventIds.regularEventId}`,
    sql`DELETE FROM domain_event_payloads WHERE event_id = ${eventIds.regularEventId}`,
    sql`UPDATE domain_event_sensitive_payloads SET event_id = ${eventIds.regularEventId} WHERE event_id = ${eventIds.sensitiveEventId}`,
    sql`UPDATE domain_event_sensitive_payloads SET event_payload = ${JSON.stringify({ reason: "changed" })} WHERE event_id = ${eventIds.sensitiveEventId}`,
    sql`DELETE FROM domain_event_sensitive_payloads WHERE event_id = ${eventIds.sensitiveEventId}`,
  ];
  for (const mutation of mutations) {
    expect(() => db.run(mutation)).toThrow();
  }
  expect(auditTablesSnapshot(db)).toEqual(before);
};

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
    expectAppendOnlyTriggers(db);
  });

  test("0003 upgrades the actually recorded old 0002 schema and resumes follow-up writes", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    restoreLegacyAuditSchema(db);
    db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at > 1786374000000"));
    db.run(sql.raw("DROP TABLE follow_up_request_claims"));
    db.run(sql.raw(
      "CREATE UNIQUE INDEX follow_up_requested_appointment_unique " +
      "ON domain_events (aggregate_id) WHERE event_name = 'follow-up.requested'",
    ));
    db.run(sql`
      INSERT INTO domain_events (
        event_id, aggregate_id, aggregate_name, aggregate_state, event_name,
        event_payload, occurred_at, actor_user_id
      ) VALUES (
        ${"11000000-0000-4000-8000-000000000001"}, ${ids.appointment},
        ${"FollowUp"}, ${null}, ${"follow-up.requested"},
        ${JSON.stringify({ appointmentId: ids.appointment, petId: ids.pet })},
        ${"2026-08-08T00:01:00.000Z"}, ${ids.actor}
      )
    `);

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
    restoreLegacyAuditSchema(db);
    db.run(sql.raw("DELETE FROM __drizzle_migrations WHERE created_at >= 1786374000000"));
    db.run(sql.raw("DROP TABLE follow_up_request_claims"));
    const legacyRows = [
      "12000000-0000-4000-8000-000000000001",
      "12000000-0000-4000-8000-000000000002",
    ] as const;
    for (const eventId of legacyRows) {
      db.run(sql`
        INSERT INTO domain_events (
          event_id, aggregate_id, aggregate_name, aggregate_state, event_name,
          event_payload, occurred_at, actor_user_id
        ) VALUES (
          ${eventId}, ${ids.appointment}, ${"FollowUp"}, ${null},
          ${"follow-up.requested"},
          ${JSON.stringify({ appointmentId: ids.appointment, petId: ids.pet })},
          ${"2026-08-08T00:01:00.000Z"}, ${ids.actor}
        )
      `);
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

  test("0004 moves every legacy audit payload to the sensitive table without changing JSON", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    restoreLegacyAuditSchema(db);
    const legacyRows = [
      {
        eventId: "13000000-0000-4000-8000-000000000001",
        aggregateState: { ownerId: ids.owner, email: "owner@example.test" },
        eventPayload: { reason: "private reason" },
      },
      {
        eventId: "13000000-0000-4000-8000-000000000002",
        aggregateState: null,
        eventPayload: { appointmentId: ids.appointment },
      },
    ] as const;
    for (const row of legacyRows) {
      db.run(sql`
        INSERT INTO domain_events (
          event_id, aggregate_id, aggregate_name, aggregate_state, event_name,
          event_payload, occurred_at, actor_user_id
        ) VALUES (
          ${row.eventId}, ${ids.owner}, ${"Owner"},
          ${row.aggregateState === null ? null : JSON.stringify(row.aggregateState)},
          ${"legacy.unknown"}, ${JSON.stringify(row.eventPayload)},
          ${"2026-08-08T00:01:00.000Z"}, ${ids.actor}
        )
      `);
    }

    migrateDatabase(db);
    migrateDatabase(db);

    const metadata = db.select().from(domainEventsTable).all();
    const regular = db.select().from(domainEventPayloadsTable).all();
    const sensitive = db
      .select()
      .from(domainEventSensitivePayloadsTable)
      .all()
      .sort((left, right) => left.eventId.localeCompare(right.eventId));
    expect(metadata).toHaveLength(legacyRows.length);
    expect(metadata.every(({ payloadSensitivity }) => payloadSensitivity === "Sensitive")).toBe(true);
    expect(regular).toEqual([]);
    expect(sensitive).toEqual(legacyRows.map((row) => ({
      eventId: row.eventId,
      aggregateState: row.aggregateState,
      eventPayload: row.eventPayload,
    })));
    expect(db.all(sql.raw("PRAGMA foreign_key_check"))).toEqual([]);
    expectAppendOnlyTriggers(db);
  });

  test("payload tables reject classification mismatch and a second placement for one event", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const eventId = "14000000-0000-4000-8000-000000000001";
    db.insert(domainEventsTable).values({
      eventId,
      aggregateId: ids.appointment,
      aggregateName: "Appointment",
      eventName: "audit.regular-fixture",
      occurredAt: "2026-08-08T00:01:00.000Z",
      actorUserId: ids.actor,
      payloadSensitivity: "Regular",
    }).run();
    const payload = { eventId, aggregateState: null, eventPayload: {} };

    expect(() => db.insert(domainEventSensitivePayloadsTable).values(payload).run())
      .toThrow(/classification/i);
    db.insert(domainEventPayloadsTable).values(payload).run();
    expect(() => db.insert(domainEventSensitivePayloadsTable).values(payload).run())
      .toThrow(/already stored/i);
  });

  test("0005 makes a journaled BASE 0004 audit database append-only", () => {
    const db = createSqliteDatabase(":memory:");
    restoreBase0004AppliedDatabase(db);
    expect(
      db.all(sql.raw(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )),
    ).toEqual([{ created_at: 1786546800000 }]);
    expect(db.all(sql.raw(`
      SELECT name FROM sqlite_master
      WHERE type = 'trigger' AND name LIKE '%_append_only_%'
    `))).toEqual([]);

    const eventIds = insertAppendOnlyAuditFixture(db);
    const before = auditTablesSnapshot(db);

    migrateDatabase(db);
    migrateDatabase(db);
    expect(
      db.all(sql.raw(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )),
    ).toEqual([{ created_at: 1786719600000 }]);
    expectAppendOnlyTriggers(db);
    expect(auditTablesSnapshot(db)).toEqual(before);
    expectAuditRowsAppendOnly(db, eventIds, before);
  });

  test("0005 advances an aee8145 database that already has append-only triggers", () => {
    const db = createSqliteDatabase(":memory:");
    restoreAee8145AppliedDatabase(db);
    expect(
      db.all(sql.raw(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )),
    ).toEqual([{ created_at: 1786546800000 }]);
    expectAppendOnlyTriggers(db);
    const eventIds = insertAppendOnlyAuditFixture(db);
    const before = auditTablesSnapshot(db);

    migrateDatabase(db);
    migrateDatabase(db);

    expect(
      db.all(sql.raw(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )),
    ).toEqual([{ created_at: 1786719600000 }]);
    expectAppendOnlyTriggers(db);
    expect(auditTablesSnapshot(db)).toEqual(before);
    expectAuditRowsAppendOnly(db, eventIds, before);
  });

  test("unknown event names are sensitive and audit serialization refuses duck typing and non-JSON values", () => {
    expect(classifyPayloadSensitivity("future.unknown-event")).toBe("Sensitive");
    let unwrapCalled = false;
    expect(() => toAuditJsonValue({
      unwrap: () => {
        unwrapCalled = true;
        return "private";
      },
    })).toThrow(/function/i);
    expect(unwrapCalled).toBe(false);
    expect(() => toAuditJsonValue(Symbol("private"))).toThrow(/symbol/i);
    expect(() => toAuditJsonValue(() => "private")).toThrow(/function/i);
  });

  test("toEventRecord recursively preserves nested Sensitive values, arrays, and objects", () => {
    const record = toEventRecord(eventWithRuntimePayload({
      nested: [
        Sensitive.of("private audit fact"),
        { deeper: Sensitive.of("private nested fact") },
      ],
    }));

    expect(record.eventPayload).toEqual({
      nested: ["private audit fact", { deeper: "private nested fact" }],
    });
  });

  test("toEventRecord rejects symbol keys before they can be omitted", () => {
    const hidden = Symbol("hidden");
    const topLevelPayload = {};
    Object.defineProperty(topLevelPayload, hidden, {
      enumerable: true,
      value: "private audit fact",
    });
    const arrayPayload: unknown[] = ["visible"];
    Object.defineProperty(arrayPayload, hidden, {
      enumerable: true,
      value: "private array fact",
    });

    expect(() => toEventRecord(eventWithRuntimePayload(topLevelPayload)))
      .toThrow(/symbol/i);
    expect(() => toEventRecord(eventWithRuntimePayload(arrayPayload)))
      .toThrow(/symbol/i);
  });

  test.each([
    ["symbol", Symbol("private")],
    ["array", ["private"]],
    ["Date", new Date("2026-08-09T00:00:00.000Z")],
    ["class instance", new (class AuditPayload { readonly fact = "private"; })()],
  ])("toEventRecord rejects a top-level %s payload", (_label, payload) => {
    expect(() => toEventRecord(eventWithRuntimePayload(payload)))
      .toThrow(/symbol|plain object/i);
  });

  test("toEventRecord rejects a nested non-finite number", () => {
    expect(() => toEventRecord(eventWithRuntimePayload({ amount: Number.POSITIVE_INFINITY })))
      .toThrow(/non-finite/i);
  });

  test("typed events update every projection and append full payloads only to sensitive history", async () => {
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
    expect(appointmentRow).toMatchObject({
      scheduledAt: "2026-08-10T01:00:00.000Z",
      durationMinutes: 30,
      serviceCode: "GeneralConsultation",
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      receptionNote: null,
      settlementStatus: "NoPayment",
      depositAmount: null,
      version: 1,
    });
    expect(JSON.stringify(appointmentRow?.state)).toContain("persistent cough");
    const resolvedAppointment = await createAppointmentByIdResolver(db).resolveById(ids.appointment);
    expect(resolvedAppointment.isOk()).toBe(true);
    expect(resolvedAppointment._unsafeUnwrap()?.visitReason.unwrap()).toBe("persistent cough");
    expect(JSON.stringify(resolvedAppointment._unsafeUnwrap())).not.toContain("persistent cough");
    expect(await db.select().from(examResultsTable)).toHaveLength(1);
    const metadata = await db.select().from(domainEventsTable);
    const regular = await db.select().from(domainEventPayloadsTable);
    const sensitive = await db.select().from(domainEventSensitivePayloadsTable);
    expect(metadata).toHaveLength(7);
    expect(metadata[0]).not.toHaveProperty("aggregateState");
    expect(metadata[0]).not.toHaveProperty("eventPayload");
    expect(metadata.every(({ payloadSensitivity }) => payloadSensitivity === "Sensitive")).toBe(true);
    expect(regular).toHaveLength(0);
    expect(sensitive).toHaveLength(metadata.length);

    const serializedMetadata = JSON.stringify(metadata);
    const serializedSensitive = JSON.stringify(sensitive);
    expect(serializedMetadata).not.toContain("owner@example.test");
    expect(serializedMetadata).not.toContain("persistent cough");
    expect(serializedSensitive).toContain("Clinic Admin");
    expect(serializedSensitive).toContain("admin@example.test");
    expect(serializedSensitive).toContain(createdUser.aggregateState.passwordHash.unwrap());
    expect(serializedSensitive).toContain(createdSession.aggregateState.tokenHash.unwrap());
    expect(serializedSensitive).toContain("Owner Hanako");
    expect(serializedSensitive).toContain("owner@example.test");
    expect(serializedSensitive).toContain("090-1111-2222");
    expect(serializedSensitive).toContain("persistent cough");
    expect(serializedSensitive).toContain("private clinical observation");
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
      kind: "StaleAppointmentVersion",
      appointmentId: ids.appointment,
      expectedVersion: 2,
    });
    expect(await db.select().from(appointmentsTable)).toHaveLength(1);
    expect(await db.select().from(domainEventsTable)).toHaveLength(3);
  });

  test("enforces half-open veterinarian overlap while allowing null assignment and self updates", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const bookAt = (
      appointmentId: AppointmentId,
      startsAt: string,
      assignedVeterinarianId: VeterinarianId | null,
      sequence: number,
    ) => Appointment.book(eventContext(sequence))({
      appointmentId,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse(startsAt),
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "Reserved",
      assignedVeterinarianId,
      visitReason: AppointmentReason.schema.parse(`private reason ${sequence}`),
      receptionNote: null,
      settlement: { kind: "NoPayment" },
    });
    const existing = bookAt(ids.appointment, "2026-08-10T10:00:00.000Z", ids.veterinarian, 46);
    (await store.store(existing))._unsafeUnwrap();

    const overlap = bookAt(ids.otherAppointment, "2026-08-10T10:29:00.000Z", ids.veterinarian, 47);
    expect((await store.store(overlap))._unsafeUnwrapErr()).toEqual({
      kind: "VeterinarianScheduleConflict",
      appointmentId: ids.otherAppointment,
      conflictingAppointmentId: ids.appointment,
    });

    const boundaryId = AppointmentId.schema.parse("00000000-0000-4000-8000-000000000012");
    expect((await store.store(bookAt(boundaryId, "2026-08-10T10:30:00.000Z", ids.veterinarian, 48))).isOk()).toBe(true);
    const unassignedId = AppointmentId.schema.parse("00000000-0000-4000-8000-000000000013");
    expect((await store.store(bookAt(unassignedId, "2026-08-10T10:15:00.000Z", null, 49))).isOk()).toBe(true);

    const selfUpdate = Appointment.update(eventContext(50))(existing.aggregateState, {
      ownerId: ids.owner,
      petId: ids.pet,
      scheduledAt: Timestamp.schema.parse("2026-08-10T10:10:00.000Z"),
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("FollowUpVisit"),
      assignedVeterinarianId: ids.veterinarian,
      visitReason: AppointmentReason.schema.parse("updated private reason"),
    });
    expect((await store.store(selfUpdate)).isOk()).toBe(true);
  });

  test.each([
    ["Scheduled", true],
    ["CheckedIn", true],
    ["InExamination", false],
    ["AwaitingPayment", false],
    ["Paid", false],
    ["Canceled", false],
  ] as const)("treats %s as overlap blocking=%s", async (status, blocking) => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const existing = Appointment.book(eventContext(51))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T10:00:00.000Z"),
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "Reserved",
      assignedVeterinarianId: ids.veterinarian,
      visitReason: AppointmentReason.schema.parse("existing private reason"),
      receptionNote: null,
      settlement: { kind: "NoPayment" },
    });
    (await store.store(existing))._unsafeUnwrap();
    db.update(appointmentsTable).set({ status }).run();
    const candidate = Appointment.book(eventContext(52))({
      appointmentId: ids.otherAppointment,
      petId: ids.otherPet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T10:15:00.000Z"),
      durationMinutes: AppointmentDuration.schema.parse(15),
      serviceCode: ServiceCode.schema.parse("FollowUpVisit"),
      bookingKind: "Reserved",
      assignedVeterinarianId: ids.veterinarian,
      visitReason: AppointmentReason.schema.parse("candidate private reason"),
      receptionNote: null,
      settlement: { kind: "NoPayment" },
    });

    const result = await store.store(candidate);
    expect(result.isErr()).toBe(blocking);
    if (blocking) expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "VeterinarianScheduleConflict" });
  });

  test("allows only one overlapping booking from two SQLite connections", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-overlap-"));
    const databasePath = join(directory, "clinic.sqlite");
    try {
      const firstDb = createSqliteDatabase(databasePath);
      migrateDatabase(firstDb);
      const secondDb = createSqliteDatabase(databasePath);
      const firstStore = createAppointmentEventStore(firstDb);
      const secondStore = createAppointmentEventStore(secondDb);
      const booked = (appointmentId: AppointmentId, sequence: number) =>
        Appointment.book(eventContext(sequence))({
          appointmentId,
          petId: ids.pet,
          ownerId: ids.owner,
          scheduledAt: Timestamp.schema.parse("2026-08-10T10:00:00.000Z"),
          durationMinutes: AppointmentDuration.schema.parse(30),
          serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
          bookingKind: "Reserved",
          assignedVeterinarianId: ids.veterinarian,
          visitReason: AppointmentReason.schema.parse(`concurrent private reason ${sequence}`),
          receptionNote: null,
          settlement: { kind: "NoPayment" },
        });

      const [first, second] = await Promise.all([
        firstStore.store(booked(ids.appointment, 53)),
        secondStore.store(booked(ids.otherAppointment, 54)),
      ]);
      expect([first, second].filter((result) => result.isOk())).toHaveLength(1);
      expect([first, second].find((result) => result.isErr())?._unsafeUnwrapErr()).toMatchObject({
        kind: "VeterinarianScheduleConflict",
      });
      expect(firstDb.select().from(appointmentsTable).all()).toHaveLength(1);
      expect(firstDb.select().from(domainEventsTable).all()).toHaveLength(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("rejects a transition whose previous version does not match the current projection", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const store = createAppointmentEventStore(db);
    const booked = Appointment.book(eventContext(44))({
      appointmentId: ids.appointment,
      petId: ids.pet,
      ownerId: ids.owner,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    (await store.store(booked))._unsafeUnwrap();
    const impossibleNewerSnapshot = {
      ...booked.aggregateState,
      version: AppointmentVersion.schema.parse(2),
    } as const;
    const staleCheckIn = Appointment.checkIn(eventContext(45))(
      impossibleNewerSnapshot,
    );

    const result = await store.store(staleCheckIn);

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "StaleAppointmentVersion",
      appointmentId: ids.appointment,
      expectedVersion: 2,
    });
    expect(db.select().from(appointmentsTable).get()).toMatchObject({
      status: "Scheduled",
      version: 1,
    });
    expect(db.select().from(domainEventsTable).all()).toHaveLength(1);
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
      kind: "StaleAppointmentVersion",
      appointmentId: ids.appointment,
      expectedVersion: 3,
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

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: "StaleAppointmentVersion",
      expectedVersion: 2,
    });
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

    const result = await store.store(Pet.delete(eventContext(22))(pet));

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

    const result = await petStore.store(staleDeletion);

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
