import { expect, it } from "vitest";

import type {
  CheckedIn,
  InExamination,
  Scheduled,
} from "../src/domain/appointment.js";

it("状態ごとに必要な情報を型で表現できる", async () => {
  const scheduled: Scheduled = {
    kind: "Scheduled",
    appointmentId: "appointment-1",
    petId: "pet-1",
    ownerId: "owner-1",
    scheduledAt: "2026-08-30T06:30:00.000Z",
  };
  const checkedIn: CheckedIn = {
    ...scheduled,
    kind: "CheckedIn",
    checkedInAt: "2026-08-30T06:20:00.000Z",
  };
  const examining: InExamination = {
    ...checkedIn,
    kind: "InExamination",
    veterinarianId: "vet-1",
    examinationStartedAt: "2026-08-30T06:30:00.000Z",
  };

  // @ts-expect-error 受付済みには受付時刻が必要です。
  const invalid: CheckedIn = { ...scheduled, kind: "CheckedIn" };
  const { Appointment } = await import("../src/domain/appointment.js");

  expect(Appointment.checkIn(scheduled, checkedIn.checkedInAt).kind).toBe("CheckedIn");
  expect(examining.veterinarianId).toBe("vet-1");
  void invalid;
});
