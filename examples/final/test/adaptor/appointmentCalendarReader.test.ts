import { describe, expect, test } from "vitest";

import { createAppointmentCalendarReader } from "../../src/adaptor/secondary/sqlite/query/appointmentCalendarReader.js";
import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable, ownersTable, petsTable, usersTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { UserId } from "../../src/domain/user/userId.js";

const actor = {
  kind: "Admin" as const,
  userId: UserId.schema.parse("83000000-0000-4000-8000-000000000001"),
  email: "admin@example.test" as never,
  name: "管理者" as never,
  passwordHash: "hash" as never,
};

test("reads only calendar-safe fields in a half-open range", async () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const petId = "83000000-0000-4000-8000-000000000002";
  const ownerId = "83000000-0000-4000-8000-000000000004";
  const veterinarianId = "83000000-0000-4000-8000-000000000003";
  database.insert(ownersTable).values({ ownerId, name: "飼い主", email: "owner@example.test", phone: "090-0000-0000" }).run();
  database.insert(petsTable).values({ petId, ownerId, name: "むぎ", species: "Cat" }).run();
  database.insert(usersTable).values({ userId: "83000000-0000-4000-8000-000000000005", role: "Veterinarian", email: "vet@example.test", name: "佐藤 獣医師", passwordHash: "hash", veterinarianId }).run();
  database.insert(appointmentsTable).values({
    appointmentId: "83000000-0000-4000-8000-000000000006",
    status: "Scheduled", ownerId, petId,
    scheduledAt: "2026-08-08T15:00:00.000Z", durationMinutes: 30,
    serviceCode: "GeneralConsultation", bookingKind: "Reserved", assignedVeterinarianId: veterinarianId,
    receptionNote: "表示してはいけない受付メモ", settlementStatus: "NoPayment", depositAmount: null, version: 1,
    state: { kind: "Scheduled" },
  }).run();
  database.insert(appointmentsTable).values({
    appointmentId: "83000000-0000-4000-8000-000000000007",
    status: "Scheduled", ownerId, petId,
    scheduledAt: "2026-08-09T15:00:00.000Z", durationMinutes: 30,
    serviceCode: "GeneralConsultation", bookingKind: "Reserved", assignedVeterinarianId: null,
    receptionNote: null, settlementStatus: "NoPayment", depositAmount: null, version: 1,
    state: { kind: "Scheduled" },
  }).run();

  const result = await createAppointmentCalendarReader(database).list(actor, {
    startsAt: Timestamp.schema.parse("2026-08-08T15:00:00.000Z"),
    endsAt: Timestamp.schema.parse("2026-08-09T15:00:00.000Z"),
  });

  expect(result._unsafeUnwrap()).toEqual([expect.objectContaining({
    petName: "むぎ", assignedVeterinarianName: "佐藤 獣医師",
    startsAt: "2026-08-08T15:00:00.000Z", endsAt: "2026-08-08T15:30:00.000Z",
  })]);
  expect(JSON.stringify(result._unsafeUnwrap())).not.toContain("表示してはいけない");
});

test("compares offset timestamps as instants at both half-open range boundaries", async () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const ownerId = "83100000-0000-4000-8000-000000000001";
  const petId = "83100000-0000-4000-8000-000000000002";
  database.insert(ownersTable).values({
    ownerId,
    name: "飼い主",
    email: "owner@example.test",
    phone: "090-0000-0000",
  }).run();
  database.insert(petsTable).values({ petId, ownerId, name: "こむぎ", species: "Dog" }).run();

  const base = {
    status: "Scheduled" as const,
    ownerId,
    petId,
    durationMinutes: 30,
    serviceCode: "GeneralConsultation" as const,
    bookingKind: "Reserved" as const,
    assignedVeterinarianId: null,
    receptionNote: null,
    settlementStatus: "NoPayment" as const,
    depositAmount: null,
    version: 1,
    state: { kind: "Scheduled" },
  };
  database.insert(appointmentsTable).values([
    {
      ...base,
      appointmentId: "83100000-0000-4000-8000-000000000010",
      scheduledAt: "2026-08-10T00:00:00+14:00",
    },
    {
      ...base,
      appointmentId: "83100000-0000-4000-8000-000000000011",
      scheduledAt: "2026-08-09T01:00:00-14:00",
    },
    {
      ...base,
      appointmentId: "83100000-0000-4000-8000-000000000012",
      scheduledAt: "2026-08-11T04:00:00+14:00",
    },
    {
      ...base,
      appointmentId: "83100000-0000-4000-8000-000000000013",
      scheduledAt: "2026-08-10T15:00:00Z",
    },
  ]).run();

  const result = await createAppointmentCalendarReader(database).list(actor, {
    startsAt: Timestamp.schema.parse("2026-08-09T15:00:00Z"),
    endsAt: Timestamp.schema.parse("2026-08-10T15:00:00Z"),
  });

  expect(result._unsafeUnwrap().map(({ appointmentId }) => appointmentId)).toEqual([
    "83100000-0000-4000-8000-000000000011",
    "83100000-0000-4000-8000-000000000012",
  ]);
});
