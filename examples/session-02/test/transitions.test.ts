import { describe, expect, it } from "vitest";

import type {
  AwaitingPayment,
  Canceled,
  CheckedIn,
  InExamination,
  Paid,
  Scheduled,
} from "../src/domain/appointment/appointment.js";
import {
  cancel,
  checkIn,
  completeExamination,
  recordPayment,
  startExamination,
} from "../src/domain/appointment/transitions.js";
import { clinicFixture } from "../../fixtures/clinic.js";

const scheduled: Scheduled = {
  kind: "Scheduled",
  appointmentId: clinicFixture.appointmentId,
  petId: clinicFixture.petId,
  ownerId: clinicFixture.ownerId,
  scheduledAt: clinicFixture.scheduledAt,
  reason: "skin check",
};
const checkedIn: CheckedIn = {
  ...scheduled,
  kind: "CheckedIn",
  checkedInAt: clinicFixture.checkedInAt,
};
const examining: InExamination = {
  ...checkedIn,
  kind: "InExamination",
  veterinarianId: clinicFixture.veterinarianId,
  examinationStartedAt: clinicFixture.scheduledAt,
};
const awaitingPayment: AwaitingPayment = {
  ...examining,
  kind: "AwaitingPayment",
  examId: clinicFixture.examId,
  examinationCompletedAt: clinicFixture.scheduledAt,
};
const paid: Paid = {
  ...awaitingPayment,
  kind: "Paid",
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
  paidAt: clinicFixture.scheduledAt,
};
const canceled: Canceled = {
  ...scheduled,
  kind: "Canceled",
  reason: "owner-request",
  canceledAt: clinicFixture.scheduledAt,
};

describe("Session 01 transition starter", () => {
  it("診察結果の記録後だけ会計できる", () => {
    const awaiting = completeExamination(
      examining,
      { examId: clinicFixture.examId },
      clinicFixture.scheduledAt,
    );
    const paidAppointment = recordPayment(
      awaiting,
      { diagnosis: "dermatitis", treatment: "ointment", amount: 4800 },
      clinicFixture.scheduledAt,
    );

    expect(awaiting.kind).toBe("AwaitingPayment");
    expect(paidAppointment.kind).toBe("Paid");
    expect(() =>
      recordPayment(
        examining,
        { diagnosis: "x", treatment: "x", amount: 1 },
        clinicFixture.scheduledAt,
      ),
    ).toThrow();
  });

  it("許可されない遷移元は実行時に例外にする", () => {
    expect(() => checkIn(checkedIn, clinicFixture.checkedInAt)).toThrow();
    expect(() => startExamination(paid, clinicFixture.veterinarianId, clinicFixture.scheduledAt)).toThrow();
    expect(() => recordPayment(scheduled, { diagnosis: "x", treatment: "x", amount: 1 }, clinicFixture.scheduledAt)).toThrow();
    expect(() => cancel(canceled, "owner-request", clinicFixture.scheduledAt)).toThrow();
  });
});
