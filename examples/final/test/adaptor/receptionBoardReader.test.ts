import { describe, expect, test } from "vitest";

import { createReceptionBoardReader } from "../../src/adaptor/secondary/sqlite/query/receptionBoardReader.js";
import { createSqliteDatabase, migrateDatabase } from "../../src/adaptor/secondary/sqlite/db.js";
import { appointmentsTable, ownersTable, petsTable, usersTable } from "../../src/adaptor/secondary/sqlite/schema.js";
import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { Sensitive } from "../../src/domain/shared/sensitive.js";
import { UserId } from "../../src/domain/user/userId.js";

const actor = { kind: "Admin" as const, userId: UserId.schema.parse("92000000-0000-4000-8000-000000000001"), email: "admin" as never, name: "管理者" as never, passwordHash: "hash" as never };
const at = (value: string) => Timestamp.schema.parse(value);

const setup = () => {
  const database = createSqliteDatabase(":memory:");
  migrateDatabase(database);
  const ownerId = "92000000-0000-4000-8000-000000000002";
  const petId = "92000000-0000-4000-8000-000000000003";
  const veterinarianId = "92000000-0000-4000-8000-000000000004";
  database.insert(ownersTable).values({ ownerId, name: "山田 花子", email: "private@example.test", phone: "090-0000-0000" }).run();
  database.insert(petsTable).values({ petId, ownerId, name: "むぎ", species: "Cat" }).run();
  database.insert(usersTable).values({ userId: "92000000-0000-4000-8000-000000000005", role: "Veterinarian", email: "vet@example.test", name: "佐藤 獣医師", passwordHash: "hash", veterinarianId }).run();
  return { database, ownerId, petId, veterinarianId };
};

describe("createReceptionBoardReader", () => {
  test("keeps the selected reception note protected while excluding all other private fields", async () => {
    const { database, ownerId, petId, veterinarianId } = setup();
    const base = { ownerId, petId, durationMinutes: 30, serviceCode: "GeneralConsultation" as const, bookingKind: "Reserved" as const, assignedVeterinarianId: veterinarianId, receptionNote: "認可済みの受付メモ", settlementStatus: "NoPayment" as const, depositAmount: null, version: 1 };
    database.insert(appointmentsTable).values({ ...base, appointmentId: "92000000-0000-4000-8000-000000000011", status: "CheckedIn", scheduledAt: "2026-08-08T15:00:00.000Z", state: { kind: "CheckedIn", checkedInAt: "2026-08-09T01:00:30.000Z", settlement: { kind: "NoPayment" }, visitReason: "秘密の来院理由", diagnosis: "秘密の診断" } }).run();
    database.insert(appointmentsTable).values({ ...base, appointmentId: "92000000-0000-4000-8000-000000000012", status: "Scheduled", scheduledAt: "2026-08-09T15:00:00.000Z", state: { kind: "Scheduled", settlement: { kind: "NoPayment" } } }).run();

    const result = await createReceptionBoardReader(database).list(actor, { startsAt: at("2026-08-08T15:00:00.000Z"), endsAt: at("2026-08-09T15:00:00.000Z") }, at("2026-08-09T01:00:00.000Z"));
    const rows = result._unsafeUnwrap();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ownerName: "山田 花子", petName: "むぎ", assignedVeterinarianName: "佐藤 獣医師", waitingMinutes: 0, statusSortAt: "2026-08-09T01:00:30.000Z" });
    expect(Sensitive.is(rows[0]?.receptionNote)).toBe(true);
    expect(rows[0]?.receptionNote?.unwrap()).toBe("認可済みの受付メモ");
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "appointmentId", "appointmentStatus", "assignedVeterinarianId", "assignedVeterinarianName", "bookingKind", "checkedInAt", "ownerName", "petName", "receptionNote", "scheduledAt", "serviceCode", "settlementStatus", "statusSortAt", "version", "waitingMinutes",
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/認可済みの受付メモ|来院理由|診断|private@example|090-/);
  });

  test("rejects a corrupt status projection whose required chronology is missing", async () => {
    const { database, ownerId, petId } = setup();
    database.insert(appointmentsTable).values({ appointmentId: "92000000-0000-4000-8000-000000000021", status: "InExamination", ownerId, petId, scheduledAt: "2026-08-09T01:00:00.000Z", durationMinutes: 30, serviceCode: "GeneralConsultation", bookingKind: "Reserved", assignedVeterinarianId: null, receptionNote: null, settlementStatus: "NoPayment", depositAmount: null, version: 1, state: { kind: "InExamination", checkedInAt: "2026-08-09T01:05:00.000Z", settlement: { kind: "NoPayment" } } }).run();

    const result = await createReceptionBoardReader(database).list(actor, { startsAt: at("2026-08-08T15:00:00.000Z"), endsAt: at("2026-08-09T15:00:00.000Z") }, at("2026-08-09T02:00:00.000Z"));

    expect(result.isErr()).toBe(true);
  });

  test.each([
    ["Scheduled with Settled", "Scheduled", "Settled", { kind: "Scheduled", settlement: { kind: "Settled", settledAt: "2026-08-09T02:00:00.000Z" } }],
    ["Canceled with DepositReceived", "Canceled", "DepositReceived", { kind: "Canceled", canceledAt: "2026-08-09T02:00:00.000Z", settlement: { kind: "DepositReceived" } }],
    ["missing settlement", "Scheduled", "NoPayment", { kind: "Scheduled" }],
    ["column/state mismatch", "Scheduled", "DepositReceived", { kind: "Scheduled", settlement: { kind: "NoPayment" } }],
  ] as const)("rejects %s as a RepositoryError", async (_label, status, settlementStatus, state) => {
    const { database, ownerId, petId } = setup();
    database.insert(appointmentsTable).values({
      appointmentId: "92000000-0000-4000-8000-000000000031",
      status,
      ownerId,
      petId,
      scheduledAt: "2026-08-09T01:00:00.000Z",
      durationMinutes: 30,
      serviceCode: "GeneralConsultation",
      bookingKind: "Reserved",
      assignedVeterinarianId: null,
      receptionNote: null,
      settlementStatus,
      depositAmount: null,
      version: 1,
      state,
    }).run();

    const result = await createReceptionBoardReader(database).list(actor, { startsAt: at("2026-08-08T15:00:00.000Z"), endsAt: at("2026-08-09T15:00:00.000Z") }, at("2026-08-09T02:00:00.000Z"));

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: "RepositoryError", operation: "ReceptionBoardReader.list" });
  });
});
