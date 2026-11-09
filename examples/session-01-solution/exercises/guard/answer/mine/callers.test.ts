import { describe, expect, it } from "vitest";

import { recordPaymentFor, startExaminationFor } from "../../subjects/callers.js";
import { appointments, awaitingPayment, checkedIn } from "./states.js";

const veterinarianId = "55555555-5555-4555-8555-555555555555";
const at = "2026-08-30T07:00:00.000Z";
const input = { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 };

describe("startExaminationFor", () => {
  it.each(appointments.filter((appointment) => appointment.kind !== "CheckedIn"))(
    "来院済み以外の予約（$kind）は受け付けない",
    (appointment) => {
      expect(() => startExaminationFor(appointment, veterinarianId, at)).toThrow();
    },
  );

  it("来院済みの予約は診察を始められる", () => {
    expect(startExaminationFor(checkedIn, veterinarianId, at).kind).toBe("InExamination");
  });
});

describe("recordPaymentFor", () => {
  it.each(appointments.filter((appointment) => appointment.kind !== "AwaitingPayment"))(
    "会計待ち以外の予約（$kind）は受け付けない",
    (appointment) => {
      expect(() => recordPaymentFor(appointment, input, at)).toThrow();
    },
  );

  it("会計待ちの予約は会計を記録できる", () => {
    expect(recordPaymentFor(awaitingPayment, input, at).kind).toBe("Paid");
  });
});
