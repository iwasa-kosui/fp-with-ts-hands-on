import { expect, it } from "vitest";

import { AppointmentId } from "../src/domain/appointmentId.js";
import { ensureFound } from "../src/domain/startExaminationErrors.js";

it("見つからない予約を AppointmentNotFound として返す", () => {
  const appointmentId = AppointmentId.schema.parse("11111111-1111-4111-8111-111111111111");

  const failed = ensureFound(undefined, appointmentId);
  const events: readonly unknown[] = [];

  expect(failed.isErr() && failed.error.kind).toBe("AppointmentNotFound");
  expect(events).toEqual([]);
});
