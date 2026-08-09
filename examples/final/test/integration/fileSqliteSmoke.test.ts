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
  ownersTable,
  petsTable,
  sessionsTable,
  usersTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { createInitialAdminSetupStore } from "../../src/adaptor/secondary/sqlite/store/initialAdminSetupStore.js";
import { createAppointmentByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createAppointmentCalendarReader } from "../../src/adaptor/secondary/sqlite/query/appointmentCalendarReader.js";
import { createReceptionBoardReader } from "../../src/adaptor/secondary/sqlite/query/receptionBoardReader.js";
import { createAppointmentEventStore } from "../../src/adaptor/secondary/sqlite/store/appointmentEventStore.js";
import { createExaminationCompletionStore } from "../../src/adaptor/secondary/sqlite/store/examinationCompletionStore.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Appointment } from "../../src/domain/appointment/appointment.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentDuration } from "../../src/domain/appointment/appointmentDuration.js";
import { AppointmentReason } from "../../src/domain/appointment/appointmentReason.js";
import { ServiceCode } from "../../src/domain/appointment/serviceCode.js";
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
    "rejects a domain-invalid 24-hour legacy timestamp in %s and rolls back schema, bodies, triggers, and journal",
    (target) => {
      const directory = mkdtempSync(join(tmpdir(), "clinic-final-invalid-upgrade-"));
      temporaryDirectories.push(directory);
      const database = createSqliteDatabase(join(directory, "clinic.sqlite"));
      migrateDatabase(database);
      restoreLegacyAppointmentSchema(database);

      const appointmentId = "7a000000-0000-4000-8000-000000000001";
      const ownerId = "7a000000-0000-4000-8000-000000000002";
      const petId = "7a000000-0000-4000-8000-000000000003";
      const invalidScheduledState = {
        kind: "Scheduled",
        appointmentId,
        ownerId,
        petId,
        scheduledAt: "2026-08-10T24:00:00Z",
        reason: "checkup",
      } as const;
      expect(Timestamp.schema.safeParse(invalidScheduledState.scheduledAt).success)
        .toBe(false);

      if (target === "projection") {
        database.run(sql`
          INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state)
          VALUES (
            ${appointmentId}, 'Scheduled', ${ownerId}, ${petId},
            ${JSON.stringify(invalidScheduledState)}
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
            ${eventId}, ${appointmentId}, 'Appointment', 'appointment.booked',
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
            '${JSON.stringify(invalidScheduledState)}',
            '{ "privateBody": "must remain byte-for-byte unchanged" }'
          )
        `));
      }

      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test("accepts a Vaccination deposit from a 0006 journal and keeps remigration idempotent", () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.run(sql.raw(
      "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
    ));
    const appointmentId = "7d400000-0000-4000-8000-000000000001";
    const ownerId = "7d400000-0000-4000-8000-000000000002";
    const petId = "7d400000-0000-4000-8000-000000000003";
    const state = {
      kind: "Scheduled",
      appointmentId,
      ownerId,
      petId,
      scheduledAt: "2026-08-10T01:00:00.000Z",
      durationMinutes: 30,
      serviceCode: "Vaccination",
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      visitReason: "vaccination",
      receptionNote: null,
      settlement: {
        kind: "DepositReceived",
        depositAmount: 7000,
        receivedAt: "2026-08-10T00:30:00.000Z",
      },
      version: 1,
    } as const;
    database.insert(appointmentsTable).values({
      appointmentId,
      status: "Scheduled",
      ownerId,
      petId,
      scheduledAt: state.scheduledAt,
      durationMinutes: state.durationMinutes,
      serviceCode: state.serviceCode,
      bookingKind: state.bookingKind,
      assignedVeterinarianId: null,
      receptionNote: null,
      settlementStatus: state.settlement.kind,
      depositAmount: state.settlement.depositAmount,
      version: state.version,
      state,
    }).run();
    const eventId = "7d400000-0000-4000-8000-000000000004";
    database.insert(domainEventsTable).values({
      eventId,
      aggregateId: appointmentId,
      aggregateName: "Appointment",
      eventName: "appointment.deposit-received",
      occurredAt: state.settlement.receivedAt,
      actorUserId: "7d400000-0000-4000-8000-000000000005",
      payloadSensitivity: "Regular",
    }).run();
    database.insert(domainEventPayloadsTable).values({
      eventId,
      aggregateState: state,
      eventPayload: { appointmentId },
    }).run();

    migrateDatabase(database);
    const afterFirstMigration = snapshotLegacyMigrationState(database);
    migrateDatabase(database);

    expect(snapshotLegacyMigrationState(database)).toEqual(afterFirstMigration);
    expect(database.get<{ count: number }>(sql.raw(
      "SELECT count(*) AS count FROM __drizzle_migrations WHERE created_at = 1786806000000",
    ))).toEqual({ count: 1 });
  });

  test.each([
    "2026-08-10T23:59:59.123+09:30",
    "2028-02-29T01:02Z",
    "2026-08-10T01:02:03+0930",
    "2026-08-10T23:59:59-14:00",
  ])("accepts legacy timestamp %s exactly when the domain schema accepts it", async (scheduledAt) => {
    const directory = mkdtempSync(join(tmpdir(), "clinic-final-valid-time-upgrade-"));
    temporaryDirectories.push(directory);
    const database = createSqliteDatabase(join(directory, "clinic.sqlite"));
    migrateDatabase(database);
    restoreLegacyAppointmentSchema(database);
    const appointmentId = "7b000000-0000-4000-8000-000000000001";
    const ownerId = "7b000000-0000-4000-8000-000000000002";
    const petId = "7b000000-0000-4000-8000-000000000003";
    expect(Timestamp.schema.safeParse(scheduledAt).success).toBe(true);
    database.run(sql`
      INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state)
      VALUES (
        ${appointmentId}, 'Scheduled', ${ownerId}, ${petId},
        ${JSON.stringify({
          kind: "Scheduled",
          appointmentId,
          ownerId,
          petId,
          scheduledAt,
          reason: "checkup",
        })}
      )
    `);

    migrateDatabase(database);

    const restored = await createAppointmentByIdResolver(database).resolveById(
      AppointmentId.schema.parse(appointmentId),
    );
    expect(restored._unsafeUnwrap()?.scheduledAt).toBe(scheduledAt);
  });

  test.each([
    ["hour", "2026-08-10T24:00:00Z"],
    ["minute", "2026-08-10T23:60:00Z"],
    ["second", "2026-08-10T23:59:60Z"],
    ["offset structure", "2026-08-10T23:59:59+9:00"],
    ["offset range", "2026-08-10T23:59:59+99:99"],
    ["maximum offset minute", "2026-08-10T23:59:59+14:01"],
    ["calendar day", "2026-02-30T23:59:59Z"],
    ["fraction without seconds", "2026-08-10T23:59.1Z"],
  ] as const)(
    "rejects a legacy timestamp with invalid %s when the domain schema rejects it",
    (_boundary, scheduledAt) => {
      const directory = mkdtempSync(join(tmpdir(), "clinic-final-invalid-time-upgrade-"));
      temporaryDirectories.push(directory);
      const database = createSqliteDatabase(join(directory, "clinic.sqlite"));
      migrateDatabase(database);
      restoreLegacyAppointmentSchema(database);
      const appointmentId = "7c000000-0000-4000-8000-000000000001";
      const ownerId = "7c000000-0000-4000-8000-000000000002";
      const petId = "7c000000-0000-4000-8000-000000000003";
      expect(Timestamp.schema.safeParse(scheduledAt).success).toBe(false);
      database.run(sql`
        INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state)
        VALUES (
          ${appointmentId}, 'Scheduled', ${ownerId}, ${petId},
          ${JSON.stringify({
            kind: "Scheduled",
            appointmentId,
            ownerId,
            petId,
            scheduledAt,
            reason: "checkup",
          })}
        )
      `);

      expect(() => migrateDatabase(database)).toThrow();
    },
  );

  test.each([
    ["projection", "missing", undefined],
    ["projection", "null", null],
    ["projection", "non-text", 123],
    ["regular audit", "missing", undefined],
    ["regular audit", "null", null],
    ["regular audit", "non-text", 123],
    ["sensitive audit", "missing", undefined],
    ["sensitive audit", "null", null],
    ["sensitive audit", "non-text", 123],
  ] as const)(
    "rejects and fully rolls back a %s Settled state with %s settledAt",
    (source, _case, settledAt) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const appointmentId = "7d500000-0000-4000-8000-000000000001";
      const ownerId = "7d500000-0000-4000-8000-000000000002";
      const petId = "7d500000-0000-4000-8000-000000000003";
      const state = {
        kind: "Paid",
        appointmentId,
        ownerId,
        petId,
        scheduledAt: "2026-08-10T01:00:00.000Z",
        serviceCode: "GeneralConsultation",
        settlement: {
          kind: "Settled",
          finalAmount: 5000,
          depositAmount: 0,
          additionalPaymentAmount: 5000,
          refundAmount: 0,
          ...(settledAt === undefined ? {} : { settledAt }),
        },
      };
      if (source === "projection") {
        database.insert(appointmentsTable).values({
          appointmentId,
          status: "Paid",
          ownerId,
          petId,
          scheduledAt: state.scheduledAt,
          durationMinutes: 30,
          serviceCode: "GeneralConsultation",
          bookingKind: "Reserved",
          assignedVeterinarianId: null,
          receptionNote: null,
          settlementStatus: "Settled",
          depositAmount: 0,
          version: 1,
          state,
        }).run();
      } else {
        const sensitivity = source === "regular audit" ? "Regular" : "Sensitive";
        const eventId = source === "regular audit"
          ? "7d500000-0000-4000-8000-000000000004"
          : "7d500000-0000-4000-8000-000000000005";
        database.insert(domainEventsTable).values({
          eventId,
          aggregateId: appointmentId,
          aggregateName: "Appointment",
          eventName: "appointment.final-settlement-recorded",
          occurredAt: "2026-08-10T02:00:00.000Z",
          actorUserId: "7d500000-0000-4000-8000-000000000006",
          payloadSensitivity: sensitivity,
        }).run();
        const payload = {
          eventId,
          aggregateState: state,
          eventPayload: { appointmentId },
        };
        if (sensitivity === "Regular") {
          database.insert(domainEventPayloadsTable).values(payload).run();
        } else {
          database.insert(domainEventSensitivePayloadsTable).values(payload).run();
        }
      }
      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test("accepts valid Settled timestamps in every source from 0006 and remains idempotent", () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.run(sql.raw(
      "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
    ));
    const appointmentId = "7d600000-0000-4000-8000-000000000001";
    const ownerId = "7d600000-0000-4000-8000-000000000002";
    const petId = "7d600000-0000-4000-8000-000000000003";
    const state = {
      kind: "Paid",
      appointmentId,
      ownerId,
      petId,
      scheduledAt: "2026-08-10T01:00:00+0930",
      serviceCode: "GeneralConsultation",
      settlement: {
        kind: "Settled",
        finalAmount: 5000,
        depositAmount: 0,
        additionalPaymentAmount: 5000,
        refundAmount: 0,
        settledAt: "2026-08-10T02:00:00+0930",
      },
    } as const;
    database.insert(appointmentsTable).values({
      appointmentId,
      status: "Paid",
      ownerId,
      petId,
      scheduledAt: state.scheduledAt,
      durationMinutes: 30,
      serviceCode: state.serviceCode,
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      receptionNote: null,
      settlementStatus: state.settlement.kind,
      depositAmount: state.settlement.depositAmount,
      version: 1,
      state,
    }).run();
    for (const [sensitivity, eventId] of [
      ["Regular", "7d600000-0000-4000-8000-000000000004"],
      ["Sensitive", "7d600000-0000-4000-8000-000000000005"],
    ] as const) {
      database.insert(domainEventsTable).values({
        eventId,
        aggregateId: appointmentId,
        aggregateName: "Appointment",
        eventName: "appointment.final-settlement-recorded",
        occurredAt: "2026-08-10T02:00:00.000Z",
        actorUserId: "7d600000-0000-4000-8000-000000000006",
        payloadSensitivity: sensitivity,
      }).run();
      const payload = {
        eventId,
        aggregateState: state,
        eventPayload: { appointmentId },
      };
      if (sensitivity === "Regular") {
        database.insert(domainEventPayloadsTable).values(payload).run();
      } else {
        database.insert(domainEventSensitivePayloadsTable).values(payload).run();
      }
    }

    migrateDatabase(database);
    const afterFirstMigration = snapshotLegacyMigrationState(database);
    migrateDatabase(database);

    expect(snapshotLegacyMigrationState(database)).toEqual(afterFirstMigration);
  });

  test("keeps a compact-offset row visible and overlap-safe after it passes 0007", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.run(sql.raw(
      "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
    ));
    const appointmentId = "7d700000-0000-4000-8000-000000000001";
    const candidateId = AppointmentId.schema.parse(
      "7d700000-0000-4000-8000-000000000002",
    );
    const ownerId = OwnerId.schema.parse("7d700000-0000-4000-8000-000000000003");
    const petId = PetId.schema.parse("7d700000-0000-4000-8000-000000000004");
    const veterinarianId = VeterinarianId.schema.parse(
      "7d700000-0000-4000-8000-000000000005",
    );
    const actorUserId = UserId.schema.parse("7d700000-0000-4000-8000-000000000006");
    database.insert(ownersTable).values({
      ownerId,
      name: "Compact Owner",
      email: "compact.owner@example.test",
      phone: "090-0000-0000",
    }).run();
    database.insert(petsTable).values({
      petId,
      ownerId,
      name: "Compact Pet",
      species: "Cat",
    }).run();
    database.insert(usersTable).values({
      userId: "7d700000-0000-4000-8000-000000000007",
      role: "Veterinarian",
      email: "compact.vet@example.test",
      name: "Compact Vet",
      passwordHash: "hash",
      veterinarianId,
    }).run();
    const scheduledAt = "2026-08-10T00:30+0930";
    const state = {
      kind: "Scheduled",
      appointmentId,
      ownerId,
      petId,
      scheduledAt,
      durationMinutes: 30,
      serviceCode: "GeneralConsultation",
      bookingKind: "Reserved",
      assignedVeterinarianId: veterinarianId,
      visitReason: "compact legacy",
      receptionNote: null,
      settlement: { kind: "NoPayment" },
      version: 1,
    } as const;
    database.insert(appointmentsTable).values({
      appointmentId,
      status: state.kind,
      ownerId,
      petId,
      scheduledAt,
      durationMinutes: state.durationMinutes,
      serviceCode: state.serviceCode,
      bookingKind: state.bookingKind,
      assignedVeterinarianId: veterinarianId,
      receptionNote: null,
      settlementStatus: state.settlement.kind,
      depositAmount: null,
      version: state.version,
      state,
    }).run();

    migrateDatabase(database);
    const actor = {
      kind: "Admin" as const,
      userId: actorUserId,
      email: UserEmail.schema.parse("admin@example.test"),
      name: UserName.schema.parse("Admin"),
      passwordHash: PasswordHash.schema.parse(
        `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
      ),
    };
    const range = {
      startsAt: Timestamp.schema.parse("2026-08-09T15:00:00Z"),
      endsAt: Timestamp.schema.parse("2026-08-10T15:00:00Z"),
    };

    expect((await createAppointmentCalendarReader(database).list(actor, range))
      ._unsafeUnwrap().map((row) => row.appointmentId)).toEqual([appointmentId]);
    expect((await createReceptionBoardReader(database).list(
      actor,
      range,
      Timestamp.schema.parse("2026-08-10T00:00:00Z"),
    ))._unsafeUnwrap().map((row) => row.appointmentId)).toEqual([appointmentId]);

    const candidate = Appointment.book({
      eventId: EventId.schema.parse("7d700000-0000-4000-8000-000000000008"),
      occurredAt: Timestamp.schema.parse("2026-08-09T14:00:00Z"),
      actorUserId,
    })({
      appointmentId: candidateId,
      ownerId,
      petId,
      scheduledAt: Timestamp.schema.parse("2026-08-10T00:45+0930"),
      durationMinutes: AppointmentDuration.schema.parse(30),
      serviceCode: ServiceCode.schema.parse("GeneralConsultation"),
      bookingKind: "Reserved",
      assignedVeterinarianId: veterinarianId,
      visitReason: AppointmentReason.schema.parse("overlapping compact candidate"),
      receptionNote: null,
    });
    const result = await createAppointmentEventStore(database).store(candidate);

    expect(result._unsafeUnwrapErr()).toEqual({
      kind: "VeterinarianScheduleConflict",
      appointmentId: candidateId,
      conflictingAppointmentId: appointmentId,
    });
    expect(database.select().from(appointmentsTable).all()).toHaveLength(1);
  });

  test.each([
    [
      "a non-vaccination deposit",
      "GeneralConsultation",
      {
        kind: "DepositReceived",
        depositAmount: 7000,
        receivedAt: "2026-08-10T00:30:00.000Z",
      },
    ],
    [
      "an inconsistent final settlement",
      "Vaccination",
      {
        kind: "Settled",
        finalAmount: 5000,
        depositAmount: 1000,
        additionalPaymentAmount: 9999,
        refundAmount: 8888,
        settledAt: "2026-08-10T02:00:00.000Z",
      },
    ],
  ] as const)("rejects a current projection containing %s before applying the invariant guard", (
    _case,
    serviceCode,
    settlement,
  ) => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.run(sql.raw(
      "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
    ));
    const appointmentId = "7d000000-0000-4000-8000-000000000001";
    const ownerId = "7d000000-0000-4000-8000-000000000002";
    const petId = "7d000000-0000-4000-8000-000000000003";
    const state = {
      kind: "Scheduled",
      appointmentId,
      ownerId,
      petId,
      scheduledAt: "2026-08-10T01:00:00.000Z",
      durationMinutes: 30,
      serviceCode,
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      visitReason: "checkup",
      receptionNote: null,
      settlement,
      version: 1,
    } as const;
    database.run(sql`
      INSERT INTO appointments (
        appointment_id, status, owner_id, pet_id, scheduled_at,
        duration_minutes, service_code, booking_kind,
        assigned_veterinarian_id, reception_note, settlement_status,
        deposit_amount, version, state
      ) VALUES (
        ${appointmentId}, 'Scheduled', ${ownerId}, ${petId}, ${state.scheduledAt},
        30, ${serviceCode}, 'Reserved', NULL, NULL, ${settlement.kind},
        ${"depositAmount" in settlement ? settlement.depositAmount : null},
        1, ${JSON.stringify(state)}
      )
    `);

    expect(() => migrateDatabase(database)).toThrow();
  });

  test.each([
    ["null", null],
    ["missing", undefined],
    ["non-text", 42],
  ] as const)(
    "rejects and fully rolls back a DepositReceived projection with a %s serviceCode",
    (_case, serviceCode) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const appointmentId = "7d100000-0000-4000-8000-000000000001";
      const ownerId = "7d100000-0000-4000-8000-000000000002";
      const petId = "7d100000-0000-4000-8000-000000000003";
      const state = {
        kind: "Scheduled",
        appointmentId,
        ownerId,
        petId,
        scheduledAt: "2026-08-10T01:00:00.000Z",
        durationMinutes: 30,
        ...(serviceCode === undefined ? {} : { serviceCode }),
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason: "checkup",
        receptionNote: null,
        settlement: {
          kind: "DepositReceived",
          depositAmount: 7000,
          receivedAt: "2026-08-10T00:30:00.000Z",
        },
        version: 1,
      };
      database.insert(appointmentsTable).values({
        appointmentId,
        status: "Scheduled",
        ownerId,
        petId,
        scheduledAt: state.scheduledAt,
        durationMinutes: 30,
        serviceCode: "Vaccination",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        receptionNote: null,
        settlementStatus: "DepositReceived",
        depositAmount: 7000,
        version: 1,
        state,
      }).run();
      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test.each([
    ["Regular", "null", null],
    ["Sensitive", "missing", undefined],
    ["Regular", "non-text", 42],
  ] as const)(
    "rejects and fully rolls back a %s audit DepositReceived state with a %s serviceCode",
    (sensitivity, _case, serviceCode) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const eventId = sensitivity === "Regular"
        ? "7d200000-0000-4000-8000-000000000001"
        : "7d200000-0000-4000-8000-000000000002";
      const appointmentId = "7d200000-0000-4000-8000-000000000003";
      const state = {
        kind: "Scheduled",
        appointmentId,
        ownerId: "7d200000-0000-4000-8000-000000000004",
        petId: "7d200000-0000-4000-8000-000000000005",
        scheduledAt: "2026-08-10T01:00:00.000Z",
        durationMinutes: 30,
        ...(serviceCode === undefined ? {} : { serviceCode }),
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason: "checkup",
        receptionNote: null,
        settlement: {
          kind: "DepositReceived",
          depositAmount: 7000,
          receivedAt: "2026-08-10T00:30:00.000Z",
        },
        version: 1,
      };
      database.insert(domainEventsTable).values({
        eventId,
        aggregateId: appointmentId,
        aggregateName: "Appointment",
        eventName: "appointment.deposit-received",
        occurredAt: "2026-08-10T00:30:00.000Z",
        actorUserId: "7d200000-0000-4000-8000-000000000006",
        payloadSensitivity: sensitivity,
      }).run();
      const payload = {
        eventId,
        aggregateState: state,
        eventPayload: { appointmentId },
      };
      if (sensitivity === "Regular") {
        database.insert(domainEventPayloadsTable).values(payload).run();
      } else {
        database.insert(domainEventSensitivePayloadsTable).values(payload).run();
      }
      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test.each([
    [
      "Regular",
      "GeneralConsultation",
      {
        kind: "DepositReceived",
        depositAmount: 7000,
        receivedAt: "2026-08-10T00:30:00.000Z",
      },
    ],
    [
      "Sensitive",
      "Vaccination",
      {
        kind: "Settled",
        finalAmount: 5000,
        depositAmount: 1000,
        additionalPaymentAmount: 9999,
        refundAmount: 8888,
        settledAt: "2026-08-10T02:00:00.000Z",
      },
    ],
  ] as const)(
    "rejects a cross-field-invalid current %s audit state",
    (sensitivity, serviceCode, settlement) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const eventId = sensitivity === "Regular"
        ? "7d300000-0000-4000-8000-000000000001"
        : "7d300000-0000-4000-8000-000000000002";
      const appointmentId = "7d300000-0000-4000-8000-000000000003";
      const state = {
        kind: settlement.kind === "Settled" ? "Paid" : "Scheduled",
        appointmentId,
        ownerId: "7d300000-0000-4000-8000-000000000004",
        petId: "7d300000-0000-4000-8000-000000000005",
        scheduledAt: "2026-08-10T01:00:00.000Z",
        serviceCode,
        settlement,
      };
      database.insert(domainEventsTable).values({
        eventId,
        aggregateId: appointmentId,
        aggregateName: "Appointment",
        eventName: "appointment.test",
        occurredAt: "2026-08-10T03:00:00.000Z",
        actorUserId: "7d300000-0000-4000-8000-000000000006",
        payloadSensitivity: sensitivity,
      }).run();
      const payload = { eventId, aggregateState: state, eventPayload: { appointmentId } };
      if (sensitivity === "Regular") {
        database.insert(domainEventPayloadsTable).values(payload).run();
      } else {
        database.insert(domainEventSensitivePayloadsTable).values(payload).run();
      }
      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test.each([
    ["Regular", "2026-08-10T12:00:00+99:99"],
    ["Sensitive", "2026-08-10T12:00:00+99:99"],
    ["Regular", "2026-08-10T24:00:00Z"],
    ["Sensitive", "2026-08-10T24:00:00Z"],
  ] as const)(
    "rejects a current %s appointment audit state timestamp %s when Timestamp.schema rejects it",
    (sensitivity, scheduledAt) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const eventId = sensitivity === "Regular"
        ? "7f000000-0000-4000-8000-000000000001"
        : "7f000000-0000-4000-8000-000000000002";
      const appointmentId = "7f000000-0000-4000-8000-000000000003";
      const invalidState = {
        kind: "Scheduled",
        appointmentId,
        scheduledAt,
      } as const;
      expect(Timestamp.schema.safeParse(invalidState.scheduledAt).success).toBe(false);
      database.insert(domainEventsTable).values({
        eventId,
        aggregateId: appointmentId,
        aggregateName: "Appointment",
        eventName: "appointment.booked",
        occurredAt: "2026-08-10T03:00:00.000Z",
        actorUserId: "7f000000-0000-4000-8000-000000000004",
        payloadSensitivity: sensitivity,
      }).run();
      const payload = {
        eventId,
        aggregateState: invalidState,
        eventPayload: { appointmentId },
      } as const;
      if (sensitivity === "Regular") {
        database.insert(domainEventPayloadsTable).values(payload).run();
      } else {
        database.insert(domainEventSensitivePayloadsTable).values(payload).run();
      }
      const before = snapshotLegacyMigrationState(database);

      expect(() => migrateDatabase(database)).toThrow();
      expect(snapshotLegacyMigrationState(database)).toEqual(before);
    },
  );

  test.each(["Projection", "Regular", "Sensitive"] as const)(
    "rejects and fully rolls back a %s timestamp with sub-millisecond precision",
    (source) => {
      const database = createSqliteDatabase(":memory:");
      migrateDatabase(database);
      database.run(sql.raw(
        "DELETE FROM __drizzle_migrations WHERE created_at = 1786806000000",
      ));
      const appointmentId = "7f100000-0000-4000-8000-000000000001";
      const ownerId = "7f100000-0000-4000-8000-000000000002";
      const petId = "7f100000-0000-4000-8000-000000000003";
      const scheduledAt = "2026-08-10T10:00:00.0005Z";
      const state = {
        kind: "Scheduled",
        appointmentId,
        ownerId,
        petId,
        scheduledAt,
        durationMinutes: 30,
        serviceCode: "GeneralConsultation",
        bookingKind: "Reserved",
        assignedVeterinarianId: null,
        visitReason: "fraction precision",
        receptionNote: null,
        settlement: { kind: "NoPayment" },
        version: 1,
      } as const;
      expect(Timestamp.schema.safeParse(scheduledAt).success).toBe(false);
      if (source === "Projection") {
        database.insert(appointmentsTable).values({
          appointmentId,
          status: "Scheduled",
          ownerId,
          petId,
          scheduledAt,
          durationMinutes: 30,
          serviceCode: "GeneralConsultation",
          bookingKind: "Reserved",
          assignedVeterinarianId: null,
          receptionNote: null,
          settlementStatus: "NoPayment",
          depositAmount: null,
          version: 1,
          state,
        }).run();
      } else {
        const eventId = source === "Regular"
          ? "7f100000-0000-4000-8000-000000000004"
          : "7f100000-0000-4000-8000-000000000005";
        database.insert(domainEventsTable).values({
          eventId,
          aggregateId: appointmentId,
          aggregateName: "Appointment",
          eventName: "appointment.booked",
          occurredAt: "2026-08-10T09:00:00Z",
          actorUserId: "7f100000-0000-4000-8000-000000000006",
          payloadSensitivity: source,
        }).run();
        const payload = {
          eventId,
          aggregateState: state,
          eventPayload: { appointmentId },
        };
        if (source === "Regular") {
          database.insert(domainEventPayloadsTable).values(payload).run();
        } else {
          database.insert(domainEventSensitivePayloadsTable).values(payload).run();
        }
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
