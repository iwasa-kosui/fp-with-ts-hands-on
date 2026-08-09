import { okAsync } from "neverthrow";
import { describe, expect, test } from "vitest";

import { Timestamp } from "../../src/domain/aggregate/timestamp.js";
import { AppointmentId } from "../../src/domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../src/domain/appointment/appointmentVersion.js";
import { ReceptionNote } from "../../src/domain/appointment/receptionNote.js";
import { VeterinarianId } from "../../src/domain/appointment/veterinarianId.js";
import { UserId } from "../../src/domain/user/userId.js";
import { GetReceptionBoardUseCase } from "../../src/useCase/getReceptionBoardUseCase.js";
import type { ReceptionBoardReaderRow } from "../../src/useCase/query/receptionBoardReader.js";

const actorUserId = UserId.schema.parse("91000000-0000-4000-8000-000000000001");
const veterinarianId = VeterinarianId.schema.parse("91000000-0000-4000-8000-000000000002");
const at = (value: string) => Timestamp.schema.parse(value);
const row = (
  suffix: string,
  appointmentStatus: ReceptionBoardReaderRow["appointmentStatus"],
  statusSortAt: string,
  overrides: Partial<ReceptionBoardReaderRow> = {},
): ReceptionBoardReaderRow => ({
  appointmentId: AppointmentId.schema.parse(`91000000-0000-4000-8000-0000000000${suffix}`),
  version: AppointmentVersion.schema.parse(1),
  bookingKind: "Reserved",
  scheduledAt: at("2026-08-09T01:00:00.000Z"),
  checkedInAt: appointmentStatus === "Scheduled" ? null : at("2026-08-09T01:05:00.000Z"),
  waitingMinutes: appointmentStatus === "Scheduled" ? null : 25,
  ownerName: `飼い主${suffix}`,
  petName: `ペット${suffix}`,
  receptionNote: ReceptionNote.schema.parse(`受付メモ${suffix}`),
  serviceCode: "GeneralConsultation",
  assignedVeterinarianId: veterinarianId,
  assignedVeterinarianName: "佐藤 獣医師",
  appointmentStatus,
  settlementStatus: appointmentStatus === "Paid" ? "Settled" : "NoPayment",
  statusSortAt: at(statusSortAt),
  ...overrides,
});

const users = {
  Admin: { kind: "Admin", userId: actorUserId, email: "admin" as never, name: "管理者" as never, passwordHash: "hash" as never },
  Receptionist: { kind: "Receptionist", userId: actorUserId, email: "reception" as never, name: "受付" as never, passwordHash: "hash" as never },
  Veterinarian: { kind: "Veterinarian", userId: actorUserId, veterinarianId, email: "vet" as never, name: "獣医師" as never, passwordHash: "hash" as never },
} as const;

describe("GetReceptionBoardUseCase", () => {
  test("uses the server clock for the JST business day and applies each section's sort contract", async () => {
    let received: unknown;
    const source = [
      row("11", "Scheduled", "2026-08-09T02:00:00.000Z", { scheduledAt: at("2026-08-09T02:00:00.000Z") }),
      row("12", "Scheduled", "2026-08-09T01:00:00.000Z"),
      row("21", "CheckedIn", "2026-08-09T01:20:00.000Z"),
      row("22", "CheckedIn", "2026-08-09T01:10:00.000Z"),
      row("31", "InExamination", "2026-08-09T01:40:00.000Z"),
      row("32", "InExamination", "2026-08-09T01:30:00.000Z"),
      row("41", "AwaitingPayment", "2026-08-09T02:20:00.000Z"),
      row("42", "AwaitingPayment", "2026-08-09T02:10:00.000Z"),
      row("51", "Paid", "2026-08-09T02:30:00.000Z"),
      row("52", "Paid", "2026-08-09T02:40:00.000Z"),
      row("61", "Canceled", "2026-08-09T02:50:00.000Z"),
    ];
    const useCase = GetReceptionBoardUseCase.create({
      clock: { now: () => at("2026-08-09T03:00:00.000Z") },
      userResolver: { resolveById: () => okAsync(users.Admin) },
      receptionBoardReader: { list: (actor, range, loadedAt) => { received = { actor, range, loadedAt }; return okAsync(source); } },
    });

    const board = (await useCase.run({ actorUserId }))._unsafeUnwrap().board;

    expect(received).toMatchObject({
      actor: { kind: "Admin" },
      range: { startsAt: "2026-08-08T15:00:00.000Z", endsAt: "2026-08-09T15:00:00.000Z" },
      loadedAt: "2026-08-09T03:00:00.000Z",
    });
    expect(board.businessDate).toBe("2026-08-09");
    expect(board.loadedAt).toBe("2026-08-09T03:00:00.000Z");
    expect(board.scheduled.map((item) => item.appointmentId)).toEqual([source[1]?.appointmentId, source[0]?.appointmentId]);
    expect(board.checkedIn.map((item) => item.appointmentId)).toEqual([source[3]?.appointmentId, source[2]?.appointmentId]);
    expect(board.inExamination.map((item) => item.appointmentId)).toEqual([source[5]?.appointmentId, source[4]?.appointmentId]);
    expect(board.awaitingPayment.map((item) => item.appointmentId)).toEqual([source[7]?.appointmentId, source[6]?.appointmentId]);
    expect(board.paid.map((item) => item.appointmentId)).toEqual([source[9]?.appointmentId, source[8]?.appointmentId]);
    expect(board.canceled).toHaveLength(1);
    expect(board.paid[0]?.receptionNote).toBe("受付メモ52");
    expect(board.canceled[0]?.receptionNote).toBe("受付メモ61");
  });

  test("sorts offset status timestamps by instant instead of their serialized text", async () => {
    const earlier = row("81", "CheckedIn", "2026-08-10T00:00:00+14:00");
    const later = row("82", "CheckedIn", "2026-08-09T23:00:00-14:00");
    const useCase = GetReceptionBoardUseCase.create({
      clock: { now: () => at("2026-08-10T14:00:00Z") },
      userResolver: { resolveById: () => okAsync(users.Admin) },
      receptionBoardReader: { list: () => okAsync([later, earlier]) },
    });

    const board = (await useCase.run({ actorUserId }))._unsafeUnwrap().board;

    expect(board.checkedIn.map(({ appointmentId }) => appointmentId)).toEqual([
      earlier.appointmentId,
      later.appointmentId,
    ]);
  });

  test.each([
    ["Receptionist", "Scheduled", "CheckIn"],
    ["Receptionist", "AwaitingPayment", "Settle"],
    ["Receptionist", "CheckedIn", "OpenDetails"],
    ["Veterinarian", "CheckedIn", "StartExamination"],
    ["Veterinarian", "Scheduled", "OpenDetails"],
    ["Admin", "Scheduled", "CheckIn"],
    ["Admin", "CheckedIn", "StartExamination"],
  ] as const)("projects %s / %s to %s without exposing internal query fields", async (role, status, expected) => {
    const useCase = GetReceptionBoardUseCase.create({
      clock: { now: () => at("2026-08-09T03:00:00.000Z") },
      userResolver: { resolveById: () => okAsync(users[role]) },
      receptionBoardReader: { list: () => okAsync([row("71", status, "2026-08-09T01:00:00.000Z")]) },
    });

    const board = (await useCase.run({ actorUserId }))._unsafeUnwrap().board;
    const projected = [...board.scheduled, ...board.checkedIn, ...board.inExamination, ...board.awaitingPayment, ...board.paid, ...board.canceled][0];

    expect(projected?.primaryAction).toBe(expected);
    expect(Object.keys(projected ?? {}).sort()).toEqual([
      "appointmentId", "appointmentStatus", "assignedVeterinarianName", "bookingKind", "checkedInAt", "ownerName", "petName", "primaryAction", "receptionNote", "scheduledAt", "serviceCode", "settlementStatus", "version", "waitingMinutes",
    ]);
    expect(projected?.receptionNote).toBe("受付メモ71");
  });
});
