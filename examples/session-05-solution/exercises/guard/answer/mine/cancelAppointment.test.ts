import { describe, expect, it } from "vitest";

import { cancelAppointment } from "../../subjects/cancelAppointment.js";
import { clockAt, paid, recordingStore, resolverOf, scheduled, validReason } from "./fakes.js";

const now = new Date("2026-01-11T00:00:00Z");

describe("cancelAppointment", () => {
  it("Scheduled の予約はキャンセルされ、保存される", async () => {
    const { store, saved } = recordingStore();
    const result = await cancelAppointment({ resolver: resolverOf(scheduled), store, clock: clockAt(now) })({
      appointmentId: scheduled.appointmentId,
      cancellationReason: validReason,
    });
    expect(result.isOk()).toBe(true);
    expect(saved).toHaveLength(1);
  });

  it("Paid の予約は InvalidAppointmentState の Err になり、保存されない", async () => {
    const { store, saved } = recordingStore();
    const result = await cancelAppointment({ resolver: resolverOf(paid), store, clock: clockAt(now) })({
      appointmentId: paid.appointmentId,
      cancellationReason: validReason,
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().kind).toBe("InvalidAppointmentState");
    expect(saved).toHaveLength(0);
  });
});
