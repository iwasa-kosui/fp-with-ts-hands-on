import { describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { z } from "zod";

import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { createAppointmentByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/appointmentResolver.js";
import { createEventHistoryReader } from "../../src/adaptor/secondary/sqlite/query/eventHistoryReader.js";
import { createFollowUpRequestReader } from "../../src/adaptor/secondary/sqlite/query/followUpRequestReader.js";
import { createExamResultByIdResolver } from "../../src/adaptor/secondary/sqlite/resolver/examResultResolver.js";
import { createFollowUpResolver } from "../../src/adaptor/secondary/sqlite/resolver/followUpResolver.js";
import {
  createUserByIdResolver,
  createUserListResolver,
} from "../../src/adaptor/secondary/sqlite/resolver/userResolver.js";
import { createUserEventStore } from "../../src/adaptor/secondary/sqlite/store/userEventStore.js";
import {
  domainEventsTable,
  followUpRequestClaimsTable,
} from "../../src/adaptor/secondary/sqlite/schema.js";
import { EventId } from "../../src/domain/aggregate/eventId.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { ExamId } from "../../src/domain/examResult/examId.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { User } from "../../src/domain/user/user.js";
import type { Admin, Receptionist } from "../../src/domain/user/user.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";
import type { SanitizedAuditRecord } from "../../src/domain/audit/eventHistoryReader.js";

const passwordHash = `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`;
const auditAdmin = {
  kind: "Admin",
  userId: UserId.schema.parse("20000000-0000-4000-8000-000000000020"),
  email: UserEmail.schema.parse("audit-admin@example.test"),
  name: UserName.schema.parse("Audit Admin"),
  passwordHash: PasswordHash.schema.parse(passwordHash),
} as const satisfies Admin;
const appointmentId = "30000000-0000-4000-8000-000000000001";
const ownerId = "30000000-0000-4000-8000-000000000002";
const petId = "30000000-0000-4000-8000-000000000003";
const examId = "30000000-0000-4000-8000-000000000004";

const scheduledState = (overrides: Readonly<Record<string, unknown>> = {}) => JSON.stringify({
  kind: "Scheduled",
  appointmentId,
  ownerId,
  petId,
  scheduledAt: "2026-08-10T01:00:00.000Z",
  reason: "checkup",
  ...overrides,
});

const insertAppointment = (
  db: ReturnType<typeof createSqliteDatabase>,
  status: string,
  rowOwnerId: string | null,
  rowPetId: string | null,
  state: string,
) => {
  const ownerSql = rowOwnerId === null ? "NULL" : `'${rowOwnerId}'`;
  const petSql = rowPetId === null ? "NULL" : `'${rowPetId}'`;
  db.run(sql.raw(
    "INSERT INTO appointments (appointment_id, status, owner_id, pet_id, state) " +
    `VALUES ('${appointmentId}', '${status}', ${ownerSql}, ${petSql}, '${state}')`,
  ));
};

const insertDomainEvent = (
  db: ReturnType<typeof createSqliteDatabase>,
  overrides: Readonly<{
    aggregateId?: string;
    aggregateName?: string;
    aggregateState?: string;
    eventPayload?: string;
  }>,
) => {
  const aggregateId = overrides.aggregateId ?? "40000000-0000-4000-8000-000000000001";
  const aggregateName = overrides.aggregateName ?? "User";
  const aggregateState = overrides.aggregateState ?? JSON.stringify({
    kind: "Admin",
    userId: aggregateId,
  });
  const eventPayload = overrides.eventPayload ?? JSON.stringify({
    userId: aggregateId,
    role: "Admin",
  });
  db.run(sql.raw(
    "INSERT INTO domain_events " +
    "(event_id, aggregate_id, aggregate_name, aggregate_state, event_name, event_payload, occurred_at, actor_user_id) " +
    `VALUES ('40000000-0000-4000-8000-000000000002', '${aggregateId}', '${aggregateName}', ` +
    `'${aggregateState}', 'user.created', '${eventPayload}', ` +
    "'2026-08-08T04:00:00.000Z', '40000000-0000-4000-8000-000000000003')",
  ));
};

const insertFollowUpEvent = (
  db: ReturnType<typeof createSqliteDatabase>,
  overrides: Readonly<Record<string, unknown>>,
) => {
  db.insert(domainEventsTable)
    .values({
      eventId: "41000000-0000-4000-8000-000000000001",
      aggregateId: appointmentId,
      aggregateName: "FollowUp",
      aggregateState: null,
      eventName: "follow-up.requested",
      eventPayload: { appointmentId, petId },
      occurredAt: "2026-08-08T04:00:00.000Z",
      actorUserId: "41000000-0000-4000-8000-000000000002",
      ...overrides,
    })
    .run();
};

describe("SQLite resolvers", () => {
  test("resolves follow-up candidates from current projections without audit rows", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw(
      `INSERT INTO owners (owner_id, name, email, phone) VALUES ('${ownerId}', 'Owner', 'owner@example.test', '090-0000-0000')`,
    ));
    db.run(sql.raw(
      `INSERT INTO pets (pet_id, owner_id, name, species) VALUES ('${petId}', '${ownerId}', 'Mugi', 'Cat')`,
    ));
    const paidState = JSON.stringify({
      kind: "Paid",
      appointmentId,
      ownerId,
      petId,
      scheduledAt: "2026-08-10T01:00:00.000Z",
      reason: "checkup",
      checkedInAt: "2026-08-10T01:10:00.000Z",
      veterinarianId: "30000000-0000-4000-8000-000000000005",
      examinationStartedAt: "2026-08-10T01:20:00.000Z",
      examId,
      examinationCompletedAt: "2026-08-10T01:30:00.000Z",
      diagnosis: "diagnosis",
      treatment: "treatment",
      amount: 4800,
      paidAt: "2026-08-10T02:00:00.000Z",
    });
    insertAppointment(db, "Paid", ownerId, petId, paidState);
    const examState = JSON.stringify({
      examId,
      petId,
      collectedAt: "2026-08-10T01:30:00.000Z",
      items: ["observation"],
      needsFollowUp: true,
    });
    db.run(sql.raw(
      `INSERT INTO exam_results (exam_id, pet_id, state) VALUES ('${examId}', '${petId}', '${examState}')`,
    ));

    const result = await createFollowUpResolver(db).resolveCandidates();

    expect(result._unsafeUnwrap()).toHaveLength(1);
    expect(result._unsafeUnwrap()[0]).not.toHaveProperty("context");
  });

  test("parses persisted rows back through domain schemas", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const userId = UserId.schema.parse("20000000-0000-4000-8000-000000000001");
    const event = User.create({
      eventId: EventId.schema.parse("20000000-0000-4000-8000-000000000002"),
      occurredAt: Timestamp.schema.parse("2026-08-08T02:00:00.000Z"),
      actorUserId: userId,
    })({
      kind: "Admin",
      userId,
      email: UserEmail.schema.parse("admin@example.test"),
      name: UserName.schema.parse("Clinic Admin"),
      passwordHash: PasswordHash.schema.parse(passwordHash),
    });
    await createUserEventStore(db).store(event);

    const resolvedUser = await createUserByIdResolver(db).resolveById(userId);
    const eventHistoryReader = createEventHistoryReader(db);
    const resolvedEvents = await eventHistoryReader.list(auditAdmin);

    if (false) {
      const receptionist = {
        ...auditAdmin,
        kind: "Receptionist",
      } as const satisfies Receptionist;
      // @ts-expect-error Audit history requires an Admin capability.
      eventHistoryReader.list(receptionist);

      const rawPayload: Readonly<Record<string, unknown>> = {
        privateNote: { nested: "must not reach a direct consumer" },
      };
      const unsafeRecord: SanitizedAuditRecord = {
        ...resolvedEvents._unsafeUnwrap()[0]!,
        // @ts-expect-error Sanitized audit DTOs accept only safe scalar values.
        eventPayload: rawPayload,
      };
      void unsafeRecord;
    }

    expect(resolvedUser.isOk() && resolvedUser.value?.kind).toBe("Admin");
    expect(resolvedUser.isOk() && resolvedUser.value?.email.unwrap()).toBe("admin@example.test");
    expect(resolvedEvents._unsafeUnwrap()).toEqual([
      {
        eventId: event.eventId,
        aggregateId: userId,
        aggregateName: "User",
        aggregateState: { kind: "Admin", userId },
        eventName: "user.created",
        eventPayload: { role: "Admin", userId },
        occurredAt: event.occurredAt,
        actorUserId: userId,
      },
    ]);
    expect(JSON.stringify(resolvedEvents._unsafeUnwrap())).not.toContain(
      "admin@example.test",
    );
    expect(JSON.stringify(resolvedEvents._unsafeUnwrap())).not.toContain(
      passwordHash,
    );
  });

  test("rejects a corrupt SQLite row instead of modeling it as a use-case error", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw(
      "INSERT INTO users (user_id, role, email, name, password_hash, veterinarian_id) " +
      "VALUES ('not-a-uuid', 'Admin', 'not-an-email', 'Broken', 'not-a-password-hash', NULL)",
    ));

    await expect(createUserListResolver(db).resolveAll()).rejects.toBeInstanceOf(
      z.ZodError,
    );
  });

  test("rejects an unknown persisted user role", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw(
      "INSERT INTO users (user_id, role, email, name, password_hash, veterinarian_id) " +
      `VALUES ('20000000-0000-4000-8000-000000000010', 'Superuser', 'root@example.test', 'Root', '${passwordHash}', NULL)`,
    ));

    await expect(createUserListResolver(db).resolveAll()).rejects.toThrow();
  });

  test("follow-up requested state comes only from the claim projection", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const auditOnlyAppointmentId = "30000000-0000-4000-8000-000000000099";
    db.insert(followUpRequestClaimsTable).values({ appointmentId }).run();
    insertFollowUpEvent(db, {
      aggregateState: { privateNote: "malformed audit must be ignored" },
    });
    insertFollowUpEvent(db, {
      eventId: "41000000-0000-4000-8000-000000000099",
      aggregateId: auditOnlyAppointmentId,
      eventPayload: { appointmentId: auditOnlyAppointmentId, petId },
    });

    const result = await createFollowUpRequestReader(db).listRequestedAppointmentIds();

    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value).toEqual([
      AppointmentId.schema.parse(appointmentId),
    ]);
  });

  test("rejects a malformed appointment id in the follow-up claim projection", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.insert(followUpRequestClaimsTable).values({ appointmentId: "not-an-appointment-id" }).run();

    await expect(
      createFollowUpRequestReader(db).listRequestedAppointmentIds(),
    ).rejects.toThrow();
  });

  test.each([
    ["Admin", "20000000-0000-4000-8000-000000000011"],
    ["Receptionist", "20000000-0000-4000-8000-000000000011"],
    ["Veterinarian", null],
  ])("rejects a %s row with a mismatched veterinarian id", async (role, veterinarianId) => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    const veterinarianSql = veterinarianId === null ? "NULL" : `'${veterinarianId}'`;
    db.run(sql.raw(
      "INSERT INTO users (user_id, role, email, name, password_hash, veterinarian_id) " +
      `VALUES ('20000000-0000-4000-8000-000000000012', '${role}', 'role@example.test', 'Role', '${passwordHash}', ${veterinarianSql})`,
    ));

    await expect(createUserListResolver(db).resolveAll()).rejects.toThrow();
  });

  test("appointment owner and pet identifiers are required by the fresh schema", () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);

    expect(() => insertAppointment(db, "Scheduled", null, null, scheduledState())).toThrow();
  });

  test.each([
    ["Canceled", ownerId, petId, scheduledState()],
    ["Scheduled", "30000000-0000-4000-8000-000000000099", petId, scheduledState()],
    ["Scheduled", ownerId, "30000000-0000-4000-8000-000000000099", scheduledState()],
  ])(
    "rejects appointment projection columns that disagree with state JSON",
    async (status, rowOwnerId, rowPetId, state) => {
      const db = createSqliteDatabase(":memory:");
      migrateDatabase(db);
      insertAppointment(db, status, rowOwnerId, rowPetId, state);

      await expect(
        createAppointmentByIdResolver(db).resolveById(
          AppointmentId.schema.parse(appointmentId),
        ),
      ).rejects.toThrow();
    },
  );

  test("rejects an exam-result pet column that disagrees with state JSON", async () => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    db.run(sql.raw(
      `INSERT INTO owners (owner_id, name, email, phone) VALUES ('${ownerId}', 'Owner', 'owner@example.test', '090-0000-0000')`,
    ));
    db.run(sql.raw(
      `INSERT INTO pets (pet_id, owner_id, name, species) VALUES ('${petId}', '${ownerId}', 'Mugi', 'Cat')`,
    ));
    const state = JSON.stringify({
      examId,
      petId: "30000000-0000-4000-8000-000000000099",
      collectedAt: "2026-08-08T04:00:00.000Z",
      items: ["observation"],
      needsFollowUp: true,
    });
    db.run(sql.raw(
      `INSERT INTO exam_results (exam_id, pet_id, state) VALUES ('${examId}', '${petId}', '${state}')`,
    ));

    await expect(
      createExamResultByIdResolver(db).resolveById(ExamId.schema.parse(examId)),
    ).rejects.toThrow();
  });

  test.each([
    [{ aggregateName: "Owner" }, "aggregate name"],
    [{ aggregateId: "not-a-uuid" }, "aggregate id"],
    [{ eventPayload: JSON.stringify({ userId: "not-a-uuid", role: "Admin" }) }, "payload"],
    [{ aggregateState: JSON.stringify({ email: "must-not-be-here@example.test" }) }, "state"],
  ])("rejects corrupt domain-event %s", async (overrides, _label) => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertDomainEvent(db, overrides);

    await expect(createEventHistoryReader(db).list(auditAdmin)).rejects.toThrow();
  });

  test.each([
    [{ eventId: "not-an-event-id" }, "event identity"],
    [{ occurredAt: "not-a-timestamp" }, "timestamp"],
    [{ actorUserId: "not-an-actor-id" }, "actor"],
    [{ aggregateName: "Appointment" }, "aggregate name"],
    [{ aggregateState: { appointmentId } }, "null aggregate state"],
    [
      {
        eventPayload: {
          appointmentId: "30000000-0000-4000-8000-000000000099",
          petId,
        },
      },
      "aggregate and payload consistency",
    ],
    [
      { eventPayload: { appointmentId, petId, privateNote: "must reject" } },
      "exact payload",
    ],
  ])("rejects a malformed follow-up history row with invalid %s", async (overrides, _label) => {
    const db = createSqliteDatabase(":memory:");
    migrateDatabase(db);
    insertFollowUpEvent(db, overrides);

    await expect(createEventHistoryReader(db).list(auditAdmin)).rejects.toThrow();
  });
});
