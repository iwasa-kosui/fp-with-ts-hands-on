import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count, sql } from "drizzle-orm";
import { afterEach, describe, expect, test } from "vitest";

import {
  createSqliteDatabase,
  migrateDatabase,
} from "../../src/adaptor/secondary/sqlite/db.js";
import {
  appointmentsTable,
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

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("file SQLite application smoke", () => {
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
    expect(persistedEvents).toHaveLength(2);
    expect(persistedEvents.map(({ eventName }) => eventName).sort()).toEqual([
      "session.created",
      "user.created",
    ]);
    const serializedEvents = JSON.stringify(persistedEvents);
    for (const privateValue of [
      "admin@example.test",
      "Clinic Admin",
      persistedAdmin?.passwordHash,
      secondConnection.select().from(sessionsTable).get()?.tokenHash,
    ]) {
      expect(serializedEvents).not.toContain(privateValue);
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

    await expect(
      createInitialAdminSetupStore(database).store(userEvent, sessionEvent),
    ).rejects.toThrow();
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
