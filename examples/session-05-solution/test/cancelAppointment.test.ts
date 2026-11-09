import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import type { Appointment, Canceled } from "../src/domain/appointment/appointment.js";
import { CancellationReason } from "../src/domain/appointment/cancellationReason.js";
import { cancelAppointment } from "../src/useCase/cancelAppointment.js";

const scheduled: Appointment = {
  kind: "Scheduled",
  appointmentId: "appointment-1",
  scheduledAt: new Date("2026-01-10T09:00:00Z"),
  reason: "予防接種",
};

const paid: Appointment = {
  kind: "Paid",
  appointmentId: "appointment-2",
  scheduledAt: new Date("2026-01-10T10:00:00Z"),
  reason: "健康診断",
  checkedInAt: new Date("2026-01-10T10:05:00Z"),
  amount: 5000,
  paidAt: new Date("2026-01-10T11:00:00Z"),
};

const reason = CancellationReason.parse("予定が変わったため")._unsafeUnwrap();
const now = new Date("2026-01-11T00:00:00Z");

const run = (appointment: Appointment) => {
  const saved: Canceled[] = [];
  const result = cancelAppointment({
    resolver: { resolveById: () => okAsync(appointment) },
    store: {
      save: (canceled) => {
        saved.push(canceled);
        return okAsync(undefined);
      },
    },
    clock: { now: () => now },
  })({ appointmentId: appointment.appointmentId, cancellationReason: reason });
  return { result, saved };
};

describe("cancelAppointment", () => {
  it("Scheduled の予約をキャンセルして保存する", async () => {
    const { result, saved } = run(scheduled);
    const canceled = (await result)._unsafeUnwrap();
    expect(canceled).toMatchObject({
      kind: "Canceled",
      reason: "予防接種",
      cancellationReason: reason,
      canceledAt: now,
    });
    expect(saved).toEqual([canceled]);
  });

  it("Paid の予約は InvalidAppointmentState で失敗し、保存しない", async () => {
    const { result, saved } = run(paid);
    expect((await result)._unsafeUnwrapErr()).toMatchObject({
      kind: "InvalidAppointmentState",
      actualKind: "Paid",
    });
    expect(saved).toEqual([]);
  });
});
