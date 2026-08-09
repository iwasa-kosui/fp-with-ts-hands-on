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
