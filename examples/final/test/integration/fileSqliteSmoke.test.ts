import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count, sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
  type SqliteDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
  domainEventsTable,
  examResultsTable,
  installationTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createInitialAdminSetupStore } from "../../src/adaptor/secondary/sqlite/store/initialAdminSetupStore.js";
import { createAppointmentByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createExaminationCompletionStore } from "../../src/adaptor/secondary/sqlite/store/examinationCompletionStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { ExamResult } from "../../src/domain/examResult/examResult.js";
import { OwnerId } from "../../src/domain/owner/ownerId.js";
import { PetId } from "../../src/domain/pet/petId.js";
import { Session } from "../../src/domain/session/session.js";
import { SessionId } from "../../src/domain/session/sessionId.js";
import { SessionTokenHash } from "../../src/domain/session/sessionTokenHash.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import {
  createApp,
  createApplicationDependencies,
} from "../../src/app.js";

const temporaryDirectories: string[] = [];
const inertiaHeaders = {
  Accept: "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
} as const;

const restoreLegacyAppointmentSchema = (database: SqliteDatabase): void => {
  const columns = database
    .all<{ name: string }>(sql.raw("PRAGMA table_info(appointments)"))
    .map(({ name }) => name);
  if (!columns.includes("scheduled_at")) return;

  database.run(sql.raw("DROP TABLE appointments"));
  database.run(sql.raw(`
    CREATE TABLE appointments (
      appointment_id text PRIMARY KEY NOT NULL,
      status text NOT NULL,
      owner_id text NOT NULL,
      pet_id text NOT NULL,
      state text NOT NULL
    )
  `));
  database.run(sql.raw(
    "DELETE FROM __drizzle_migrations WHERE created_at > 1786633200000",
  ));
};

const snapshotLegacyMigrationState = (database: SqliteDatabase) => ({
  schema: database.all(sql.raw(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_master
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `)),
  appointments: database.all(sql.raw(
    "SELECT * FROM appointments ORDER BY appointment_id",
  )),
  events: database.all(sql.raw(
    "SELECT * FROM domain_events ORDER BY event_id",
  )),
  regularPayloads: database.all(sql.raw(
    "SELECT * FROM domain_event_payloads ORDER BY event_id",
  )),
  sensitivePayloads: database.all(sql.raw(
    "SELECT * FROM domain_event_sensitive_payloads ORDER BY event_id",
  )),
  migrationJournal: database.all(sql.raw(
    "SELECT * FROM __drizzle_migrations ORDER BY id",
  )),
});

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("file SQLite application smoke", () => {
  test("upgrades legacy Paid and Canceled appointment rows and audit states without inventing a canceled visit reason", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-appointment-upgrade-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "clinic.sqlite");
    const database = createSqliteDatabase(databasePath);
    migrateDatabase(database);

    restoreLegacyAppointmentSchema(database);

    const paidAppointmentId = "79000000-0000-4000-8000-000000000001";
    const canceledAppointmentId = "79000000-0000-4000-8000-000000000002";
    const ownerId = "79000000-0000-4000-8000-000000000003";
    const petId = "79000000-0000-4000-8000-000000000004";
    const veterinarianId = "79000000-0000-4000-8000-000000000005";
    const common = {
      petId,
      ownerId,
      scheduledAt: "2026-08-10T01:00:00.000Z",
    } as const;
    const legacyPaid = {
      kind: "Paid",
      appointmentId: paidAppointmentId,
      ...common,
      reason: "legacy paid visit reason",
      checkedInAt: "2026-08-10T01:00:00.000Z",
      veterinarianId,
      examinationStartedAt: "2026-08-10T01:10:00.000Z",
      examId: "79000000-0000-4000-8000-000000000006",
      examinationCompletedAt: "2026-08-10T01:20:00.000Z",
      diagnosis: "legacy diagnosis",
      treatment: "legacy treatment",
      amount: 4800,
      paidAt: "2026-08-10T01:30:00.000Z",
    } as const;
    const legacyCanceled = {
      kind: "Canceled",
      appointmentId: canceledAppointmentId,
      ...common,
      reason: "legacy cancellation reason",
      canceledAt: "2026-08-09T01:30:00.000Z",
    } as const;
    for (const [status, state] of [
      ["Paid", legacyPaid],
      ["Canceled", legacyCanceled],
    ] as const) {
      database.run(sql`
        INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state)
        VALUES (${state.appointmentId}, ${status}, ${ownerId}, ${petId}, ${JSON.stringify(state)})
      `);
    }
    const legacyEventId = "79000000-0000-4000-8000-000000000007";
    database.insert(domainEventsTable).values({
      eventId: legacyEventId,
      aggregateId: paidAppointmentId,
      aggregateName: "Appointment",
      eventName: "appointment.payment-recorded",
      occurredAt: legacyPaid.paidAt,
      actorUserId: "79000000-0000-4000-8000-000000000008",
      payloadSensitivity: "Sensitive",
    }).run();
    database.insert(domainEventSensitivePayloadsTable).values({
      eventId: legacyEventId,
      aggregateState: legacyPaid,
      eventPayload: { appointmentId: paidAppointmentId },
    }).run();
    const legacyRegularEventId = "79000000-0000-4000-8000-000000000009";
    const regularEventPayload = '{ "appointmentId": "regular-payload-preserved" }';
    database.run(sql`
      INSERT INTO domain_events (
        event_id, aggregate_id, aggregate_name, event_name, occurred_at,
        actor_user_id, payload_sensitivity
      ) VALUES (
        ${legacyRegularEventId}, ${canceledAppointmentId}, 'Appointment',
        'appointment.canceled', ${legacyCanceled.canceledAt},
        '79000000-0000-4000-8000-000000000008', 'Regular'
      )
    `);
    database.run(sql`
      INSERT INTO domain_event_payloads (event_id, aggregate_state, event_payload)
      VALUES (
        ${legacyRegularEventId}, ${JSON.stringify(legacyCanceled)},
        ${regularEventPayload}
      )
    `);
    const auditMetadataBefore = database.all(sql.raw(`
      SELECT * FROM domain_events
      WHERE event_id IN (
        '79000000-0000-4000-8000-000000000007',
        '79000000-0000-4000-8000-000000000009'
      )
      ORDER BY event_id
    `));
    const regularEventPayloadBefore = database.get(sql.raw(`
      SELECT event_payload FROM domain_event_payloads
      WHERE event_id = '79000000-0000-4000-8000-000000000009'
    `));
    const sensitiveEventPayloadBefore = database.get(sql.raw(`
      SELECT event_payload FROM domain_event_sensitive_payloads
      WHERE event_id = '79000000-0000-4000-8000-000000000007'
    `));

    migrateDatabase(database);
    migrateDatabase(database);

    const paid = (
      await createAppointmentByIdResolver(database).resolveById(
        AppointmentId.schema.parse(paidAppointmentId),
      )
    )._unsafeUnwrap();
    expect(paid).toMatchObject({
      kind: "Paid",
      visitReason: expect.objectContaining({}),
      serviceCode: "GeneralConsultation",
      durationMinutes: 30,
      bookingKind: "Reserved",
      assignedVeterinarianId: veterinarianId,
      receptionNote: null,
      version: 1,
      settlement: {
        kind: "Settled",
        finalAmount: 4800,
        depositAmount: 0,
        additionalPaymentAmount: 4800,
        refundAmount: 0,
        settledAt: legacyPaid.paidAt,
      },
    });
    expect(paid).not.toHaveProperty("amount");
    expect(paid).not.toHaveProperty("paidAt");

    const canceled = (
      await createAppointmentByIdResolver(database).resolveById(
        AppointmentId.schema.parse(canceledAppointmentId),
      )
    )._unsafeUnwrap();
    expect(canceled).toMatchObject({
      kind: "Canceled",
      cancellationReason: expect.objectContaining({}),
      settlement: { kind: "NoPayment" },
      version: 1,
    });
    expect(canceled?.kind === "Canceled" && canceled.visitReason.unwrap()).toBe(
      "移行前データ（来院理由不明）",
    );
    expect(canceled?.kind === "Canceled" && canceled.cancellationReason.unwrap()).toBe(
      "legacy cancellation reason",
    );

    const migratedAuditState = database
      .select()
      .from(domainEventSensitivePayloadsTable)
      .get()?.aggregateState;
    expect(migratedAuditState).toMatchObject({
      kind: "Paid",
      visitReason: "legacy paid visit reason",
      version: 1,
      settlement: {
        kind: "Settled",
        finalAmount: 4800,
        additionalPaymentAmount: 4800,
      },
    });
    expect(migratedAuditState).not.toHaveProperty("amount");
    expect(migratedAuditState).not.toHaveProperty("paidAt");
    expect(database.all(sql.raw(`
      SELECT * FROM domain_events
      WHERE event_id IN (
        '79000000-0000-4000-8000-000000000007',
        '79000000-0000-4000-8000-000000000009'
      )
      ORDER BY event_id
    `))).toEqual(auditMetadataBefore);
    expect(database.get(sql.raw(`
      SELECT event_payload FROM domain_event_payloads
      WHERE event_id = '79000000-0000-4000-8000-000000000009'
    `))).toEqual(regularEventPayloadBefore);
    expect(database.get(sql.raw(`
      SELECT event_payload FROM domain_event_sensitive_payloads
      WHERE event_id = '79000000-0000-4000-8000-000000000007'
    `))).toEqual(sensitiveEventPayloadBefore);
    expect(database
      .select()
      .from(domainEventPayloadsTable)
      .get()?.aggregateState).toMatchObject({
        kind: "Canceled",
        visitReason: "移行前データ（来院理由不明）",
        cancellationReason: "legacy cancellation reason",
        settlement: { kind: "NoPayment" },
        version: 1,
      });
  });

  test.each([
    "projection",
    "regular audit",
    "sensitive audit",
  ] as const)(
    "rejects malformed legacy Canceled state in %s and rolls back schema, bodies, triggers, and journal",
    (target) => {
      const directory = mkdtempSync(join(tmpdir(), "clinic-final-invalid-upgrade-"));
      temporaryDirectories.push(directory);
      const database = createSqliteDatabase(join(directory, "clinic.sqlite"));
      migrateDatabase(database);
      restoreLegacyAppointmentSchema(database);

      const appointmentId = "7a000000-0000-4000-8000-000000000001";
      const ownerId = "7a000000-0000-4000-8000-000000000002";
      const petId = "7a000000-0000-4000-8000-000000000003";
      const invalidCanceledState = {
        kind: "Canceled",
        appointmentId,
        ownerId,
        petId,
        scheduledAt: "2026-08-10T01:00:00.000Z",
        canceledAt: "2026-08-09T01:30:00.000Z",
      } as const;

      if (target === "projection") {
        database.run(sql`
          INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state)
          VALUES (
            ${appointmentId}, 'Canceled', ${ownerId}, ${petId},
            ${JSON.stringify(invalidCanceledState)}
          )
        `);
      } else {
        const eventId = target === "regular audit"
          ? "7a000000-0000-4000-8000-000000000004"
          : "7a000000-0000-4000-8000-000000000005";
        const sensitivity = target === "regular audit" ? "Regular" : "Sensitive";
        database.run(sql`
          INSERT INTO domain_events (
            event_id, aggregate_id, aggregate_name, event_name, occurred_at,
            actor_user_id, payload_sensitivity
          ) VALUES (
            ${eventId}, ${appointmentId}, 'Appointment', 'appointment.canceled',
            '2026-08-09T01:30:00.000Z',
            '7a000000-0000-4000-8000-000000000006', ${sensitivity}
          )
        `);
        const payloadTable = target === "regular audit"
          ? "domain_event_payloads"
          : "domain_event_sensitive_payloads";
        database.run(sql.raw(`
          INSERT INTO ${payloadTable} (event_id, aggregate_state, event_payload)
          VALUES (
            '${eventId}',
            '${JSON.stringify(invalidCanceledState)}',
            '{ "privateBody": "must remain byte-for-byte unchanged" }'
          )
        `));
      }

      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test("migrates a new file and persists first-admin setup through the real app", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "clinic.sqlite");
    const database = createSqliteDatabase(databasePath);

    migrateDatabase(database);
    migrateDatabase(database);

    expect(existsSync(databasePath)).toBe(true);
    expect(
      database
        .all<{ name: string }>(
          sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
        )
        .map(({ name }) => name),
    ).toEqual(
      expect.arrayContaining([
        "__drizzle_migrations",
        "domain_events",
        "installation",
        "users",
      ]),
    );

    const now = Timestamp.schema.parse("2026-08-09T04:30:00.000Z");
    const app = createApp(
      createApplicationDependencies(database, {
        clock: { now: () => now },
        isProduction: false,
      }),
    );
    const beforeSetup = await app.request("/", { headers: inertiaHeaders });

    expect(beforeSetup.status).toBe(302);
    expect(beforeSetup.headers.get("location")).toBe("/setup");

    const setupResponse = await app.request("/setup", {
      method: "POST",
      body: new URLSearchParams({
        email: "admin@example.test",
        name: "Clinic Admin",
        password: "correct horse battery staple",
      }),
      headers: {
        ...inertiaHeaders,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "http://localhost",
      },
    });

    expect(setupResponse.status).toBe(302);
    expect(setupResponse.headers.get("location")).toBe("/");
    expect(database.select({ value: count() }).from(installationTable).get())
      .toEqual({ value: 1 });
    expect(database.select({ value: count() }).from(usersTable).get()).toEqual({
      value: 1,
    });
    expect(database.select({ value: count() }).from(domainEventsTable).get())
      .toEqual({ value: 2 });

    const secondConnection = createSqliteDatabase(databasePath);
    const persistedAdmin = secondConnection.select().from(usersTable).get();
    expect(persistedAdmin).toMatchObject({
      email: "admin@example.test",
      name: "Clinic Admin",
      role: "Admin",
    });
    expect(secondConnection.select({ value: count() }).from(installationTable).get()).toEqual({
      value: 1,
    });
    expect(secondConnection.select({ value: count() }).from(usersTable).get()).toEqual({
      value: 1,
    });
    expect(secondConnection.select({ value: count() }).from(sessionsTable).get()).toEqual({
      value: 1,
    });
    const persistedEvents = secondConnection.select().from(domainEventsTable).all();
    const regularPayloads = secondConnection.select().from(domainEventPayloadsTable).all();
    const sensitivePayloads = secondConnection
      .select()
      .from(domainEventSensitivePayloadsTable)
      .all();
    expect(persistedEvents).toHaveLength(2);
    expect(regularPayloads).toEqual([]);
    expect(sensitivePayloads).toHaveLength(persistedEvents.length);
    expect(persistedEvents.map(({ eventName }) => eventName).sort()).toEqual([
      "session.created",
      "user.created",
    ]);
    const serializedEvents = JSON.stringify(persistedEvents);
    const serializedSensitivePayloads = JSON.stringify(sensitivePayloads);
    for (const privateValue of [
      "admin@example.test",
      "Clinic Admin",
      persistedAdmin?.passwordHash,
      secondConnection.select().from(sessionsTable).get()?.tokenHash,
    ]) {
      expect(serializedEvents).not.toContain(privateValue);
      expect(serializedSensitivePayloads).toContain(privateValue);
    }
  });

  test("rolls back marker, Admin, session, and events in a file when the second audit insert fails", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-rollback-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "clinic.sqlite");
    const database = createSqliteDatabase(databasePath);
    migrateDatabase(database);

    const userId = UserId.schema.parse("76000000-0000-4000-8000-000000000001");
    const duplicateEventId = EventId.schema.parse(
      "76000000-0000-4000-8000-000000000002",
    );
    const occurredAt = Timestamp.schema.parse("2026-08-09T05:00:00.000Z");
    const userEvent = User.create({
      eventId: duplicateEventId,
      occurredAt,
      actorUserId: userId,
    })({
      kind: "Admin",
      userId,
      email: UserEmail.schema.parse("rollback-admin@example.test"),
      name: UserName.schema.parse("Rollback Admin"),
      passwordHash: PasswordHash.schema.parse(
        `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
      ),
    });
    const sessionEvent = Session.create({
      eventId: duplicateEventId,
      occurredAt,
      actorUserId: userId,
    })({
      sessionId: SessionId.schema.parse(
        "76000000-0000-4000-8000-000000000003",
      ),
      userId,
      tokenHash: SessionTokenHash.schema.parse("a".repeat(64)),
      expiresAt: Timestamp.schema.parse("2026-08-09T13:00:00.000Z"),
    });

    const result = await createInitialAdminSetupStore(database).store(
      userEvent,
      sessionEvent,
    );

    expect(result.isErr() && result.error.kind).toBe("RepositoryError");
    const secondConnection = createSqliteDatabase(databasePath);
    expect(secondConnection.select({ value: count() }).from(installationTable).get()).toEqual({
      value: 0,
    });
    expect(secondConnection.select({ value: count() }).from(usersTable).get()).toEqual({
      value: 0,
    });
    expect(secondConnection.select({ value: count() }).from(sessionsTable).get()).toEqual({
      value: 0,
    });
    expect(secondConnection.select({ value: count() }).from(domainEventsTable).get()).toEqual({
      value: 0,
    });
    expect(secondConnection.select({ value: count() }).from(domainEventPayloadsTable).get()).toEqual({
      value: 0,
    });
    expect(secondConnection.select({ value: count() }).from(domainEventSensitivePayloadsTable).get()).toEqual({
      value: 0,
    });
  });

  test("keeps an existing appointment and restores AwaitingPayment through a second file connection", async () => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-awaiting-payment-"));
    temporaryDirectories.push(directory);
    const databasePath = join(directory, "clinic.sqlite");
    const database = createSqliteDatabase(databasePath);
    migrateDatabase(database);

    const actorUserId = UserId.schema.parse(
      "78000000-0000-4000-8000-000000000001",
    );
    const appointmentId = AppointmentId.schema.parse(
      "78000000-0000-4000-8000-000000000002",
    );
    const ownerId = OwnerId.schema.parse(
      "78000000-0000-4000-8000-000000000003",
    );
    const petId = PetId.schema.parse(
      "78000000-0000-4000-8000-000000000004",
    );
    const veterinarianId = VeterinarianId.schema.parse(
      "78000000-0000-4000-8000-000000000005",
    );
    const examId = ExamId.schema.parse(
      "78000000-0000-4000-8000-000000000006",
    );
    const context = (eventId: string, occurredAt: string) => ({
      eventId: EventId.schema.parse(eventId),
      occurredAt: Timestamp.schema.parse(occurredAt),
      actorUserId,
    });
    const booked = Appointment.book(
      context(
        "78000000-0000-4000-8000-000000000010",
        "2026-08-09T06:00:00.000Z",
      ),
    )({
      appointmentId,
      ownerId,
      petId,
      scheduledAt: Timestamp.schema.parse("2026-08-10T01:00:00.000Z"),
      reason: AppointmentReason.schema.parse("private reason"),
    });
    const checkedIn = Appointment.checkIn(
      context(
        "78000000-0000-4000-8000-000000000011",
        "2026-08-10T01:00:00.000Z",
      ),
    )(booked.aggregateState);
    const started = Appointment.startExamination(
      context(
        "78000000-0000-4000-8000-000000000012",
        "2026-08-10T01:10:00.000Z",
      ),
    )(checkedIn.aggregateState, veterinarianId);
    (
      await createAppointmentEventStore(database).store(
        booked,
        checkedIn,
        started,
      )
    )._unsafeUnwrap();
    const existingEventIds = database
      .select({ eventId: domainEventsTable.eventId })
      .from(domainEventsTable)
      .all();

    migrateDatabase(database);
    const examResult = ExamResult.create(
      context(
        "78000000-0000-4000-8000-000000000013",
        "2026-08-10T01:20:00.000Z",
      ),
    )(
      ExamResult.parse({
        examId,
        petId,
        collectedAt: "2026-08-10T01:20:00.000Z",
        items: ["private clinical result"],
        needsFollowUp: false,
      })._unsafeUnwrap(),
    );
    const completed = Appointment.completeExamination(
      context(
        "78000000-0000-4000-8000-000000000014",
        "2026-08-10T01:20:00.000Z",
      ),
    )(started.aggregateState, { examId });
    (
      await createExaminationCompletionStore(database).store(
        examResult,
        completed,
      )
    )._unsafeUnwrap();

    const secondConnection = createSqliteDatabase(databasePath);
    expect(
      (
        await createAppointmentByIdResolver(secondConnection).resolveById(
          appointmentId,
        )
      )._unsafeUnwrap(),
    ).toMatchObject({
      kind: "AwaitingPayment",
      examId,
      examinationCompletedAt: "2026-08-10T01:20:00.000Z",
    });
    expect(secondConnection.select().from(appointmentsTable).all()).toHaveLength(1);
    expect(secondConnection.select().from(examResultsTable).all()).toHaveLength(1);
    expect(
      secondConnection
        .select({ eventId: domainEventsTable.eventId })
        .from(domainEventsTable)
        .all(),
    ).toEqual(expect.arrayContaining(existingEventIds));
    expect(secondConnection.select().from(domainEventsTable).all()).toHaveLength(5);
  });
});
