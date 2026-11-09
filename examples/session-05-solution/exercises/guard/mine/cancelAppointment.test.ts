import { describe, expect, it } from "vitest";

import { cancelAppointment } from "../subjects/cancelAppointment.js";
import { clockAt, paid, recordingStore, resolverOf, validReason } from "./fakes.js";

describe("cancelAppointment", () => {
  it("会計済みの予約をキャンセルしようとしたとき", async () => {
    const { store } = recordingStore();
    const run = cancelAppointment({
      resolver: resolverOf(paid),
      store,
      clock: clockAt(new Date("2026-01-11T00:00:00Z")),
    });
    const result = await run({ appointmentId: paid.appointmentId, cancellationReason: validReason });
    // ここに Paid の予約で Err になることを書きます
  });
});
