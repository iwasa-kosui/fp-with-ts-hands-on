import { describe, expect, it } from "vitest";

import { ExamResult } from "../src/boundary/examResult.js";
import {
  bookAppointment,
  updateStatus,
  type BookAppointmentInput,
} from "../src/domain/appointment/appointment.js";

const input = {
  appointmentId: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  petName: "Mugi",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
} as const satisfies BookAppointmentInput;

describe("Session 00 setup", () => {
  it("未改善の現行システムが会計済みを診察中へ戻してしまう", () => {
    const paid = updateStatus(bookAppointment(input), "paid", { amount: 4800 });

    expect(updateStatus(paid, "in-examination").status).toBe("in-examination");
  });

  it("未改善の現行システムが未知の状態とID取り違えを受け入れてしまう", () => {
    const appointment = updateStatus(bookAppointment(input), "waiting-for-magic", {
      petId: input.ownerId,
    });

    expect(appointment).toMatchObject({
      status: "waiting-for-magic",
      petId: input.ownerId,
    });
  });

  it("名前だけの入力境界が不正な検査結果を受け入れてしまう", () => {
    expect(ExamResult.parse({ items: "not-an-array" })).toEqual({
      items: "not-an-array",
    });
  });
});
