import { Buffer } from "node:buffer";
import { describe, expect, test } from "vitest";

import { ensureAppointmentScheduledTimestampsValid } from "../../src/adaptor/secondary/sqlite/appointmentTimestampPreflight.js";
import { createAppointmentCalendarReader } from "../../src/adaptor/secondary/sqlite/query/appointmentCalendarReader.js";
import { createReceptionBoardReader } from "../../src/adaptor/secondary/sqlite/query/receptionBoardReader.js";
import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable, ownersTable, petsTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { PasswordHash } from "../../src/domain/user/passwordHash.js";
import { UserEmail } from "../../src/domain/user/userEmail.js";
import { UserId } from "../../src/domain/user/userId.js";
import { UserName } from "../../src/domain/user/userName.js";

const actor = {
  kind: "Admin" as const,
  userId: UserId.schema.parse("92300000-0000-4000-8000-000000000001"),
  email: UserEmail.schema.parse("admin@example.test"),
  name: UserName.schema.parse("管理者"),
  passwordHash: PasswordHash.schema.parse(
    `scrypt$${"A".repeat(22)}==$${"B".repeat(86)}==`,
  ),
};

type CorruptTimestamp = string | number | Buffer | null;

const setup = (scheduledAt: CorruptTimestamp) => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const ownerId = "92300000-0000-4000-8000-000000000002";
  const petId = "92300000-0000-4000-8000-000000000003";
  const appointmentId = "92300000-0000-4000-8000-000000000004";
  database.insert(ownersTable).values({
    ownerId,
    name: "飼い主",
    email: "private@example.test",
    phone: "090-0000-0000",
  }).run();
  database.insert(petsTable).values({
    petId,
    ownerId,
    name: "むぎ",
    species: "Cat",
  }).run();
  database.insert(appointmentsTable).values({
    appointmentId,
    status: "Scheduled",
    ownerId,
    petId,
    scheduledAt: "2026-08-10T01:00:00Z",
    durationMinutes: 30,
    serviceCode: "GeneralConsultation",
    bookingKind: "Reserved",
    assignedVeterinarianId: null,
    receptionNote: "preflightで取得してはいけないPII",
    settlementStatus: "NoPayment",
    depositAmount: null,
    version: 1,
    state: { kind: "Scheduled", settlement: { kind: "NoPayment" } },
  }).run();
  database.$client.pragma("foreign_keys = OFF");
  database.$client.exec(`
    CREATE TABLE appointments_corrupt AS SELECT * FROM appointments;
    DROP TABLE appointments;
    ALTER TABLE appointments_corrupt RENAME TO appointments;
  `);
  database.$client.pragma("foreign_keys = ON");
  database.$client.prepare(
    "UPDATE appointments SET scheduled_at = ? WHERE appointment_id = ?",
  ).run(scheduledAt, appointmentId);
  return database;
};

const ranges = {
  insideSqliteInterpretation: {
    startsAt: Timestamp.schema.parse("1999-01-01T00:00:00Z"),
    endsAt: Timestamp.schema.parse("2027-01-01T00:00:00Z"),
  },
  outsideSqliteInterpretation: {
    startsAt: Timestamp.schema.parse("2030-01-01T00:00:00Z"),
    endsAt: Timestamp.schema.parse("2031-01-01T00:00:00Z"),
  },
} as const;

describe("appointment scheduled timestamp preflight", () => {
  test("selects scheduled_at without appointment PII or free-text columns", () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.$client.exec(`
      DROP TABLE appointments;
      CREATE VIEW appointments AS
        SELECT 'not-a-timestamp' AS scheduled_at;
    `);

    expect(() => ensureAppointmentScheduledTimestampsValid(database))
      .toThrow("Corrupt appointment scheduled timestamp projection");
  });

  test.each([
    ["BLOB ISO timestamp", Buffer.from("2026-08-10T01:02:03Z")],
    ["numeric Julian day", 2451545],
    ["numeric Julian day string", "2451545"],
    ["date only", "2026-08-10"],
    ["timezone missing", "2026-08-10T01:02"],
    ["impossible calendar day", "2026-02-30T01:00Z"],
    ["24 hour", "2026-08-10T24:00:00Z"],
    ["offset beyond 14 hours", "2026-08-10T01:02+14:01"],
    ["empty string", ""],
    ["NULL", null],
  ] satisfies ReadonlyArray<readonly [string, CorruptTimestamp]>) (
    "rejects %s for both readers before range filtering",
    async (_case, scheduledAt) => {
      for (const range of Object.values(ranges)) {
        const database = setup(scheduledAt);

        const calendarResult = await createAppointmentCalendarReader(database)
          .list(actor, range);
        const receptionResult = await createReceptionBoardReader(database).list(
          actor,
          range,
          Timestamp.schema.parse("2026-08-10T02:00:00Z"),
        );

        expect(calendarResult._unsafeUnwrapErr()).toMatchObject({
          kind: "RepositoryError",
          operation: "AppointmentCalendarReader.list",
        });
        expect(receptionResult._unsafeUnwrapErr()).toMatchObject({
          kind: "RepositoryError",
          operation: "ReceptionBoardReader.list",
        });
      }
    },
  );

  test("maps a preflight query failure to each reader's RepositoryError", async () => {
    const database = createSqliteDatabase(":memory:");
    migrateDatabase(database);
    database.$client.exec("DROP TABLE appointments");

    const calendarResult = await createAppointmentCalendarReader(database).list(
      actor,
      ranges.insideSqliteInterpretation,
    );
    const receptionResult = await createReceptionBoardReader(database).list(
      actor,
      ranges.insideSqliteInterpretation,
      Timestamp.schema.parse("2026-08-10T02:00:00Z"),
    );

    expect(calendarResult._unsafeUnwrapErr()).toMatchObject({
      kind: "RepositoryError",
      operation: "AppointmentCalendarReader.list",
    });
    expect(receptionResult._unsafeUnwrapErr()).toMatchObject({
      kind: "RepositoryError",
      operation: "ReceptionBoardReader.list",
    });
  });
});
