import { beforeEach, expect, it } from "vitest";

import {
  bookAppointment,
  resetLegacyStore,
  updateStatus,
  type BookAppointmentInput,
  type LegacyAppointment,
} from "../src/appointment.js";

const appointmentInput = {
  id: "11111111-1111-4111-8111-111111111111",
  petId: "22222222-2222-4222-8222-222222222222",
  petName: "Mugi",
  ownerId: "33333333-3333-4333-8333-333333333333",
  ownerName: "Owner A",
  ownerEmail: "owner@example.test",
  ownerPhone: "090-0000-0000",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
} as const satisfies BookAppointmentInput;

const createPaidAppointmentThroughLegacyApi = (): LegacyAppointment => {
  const scheduled = bookAppointment(appointmentInput);
  updateStatus(scheduled.id, "checked-in");
  updateStatus(scheduled.id, "in-examination", {
    veterinarianId: "44444444-4444-4444-8444-444444444444",
  });
  return updateStatus(scheduled.id, "paid", {
    diagnosis: "dermatitis",
    treatment: "ointment",
    amount: 4800,
  });
};

beforeEach(resetLegacyStore);

it("会計済みの来院は診察中に戻せないはず", () => {
  const paid = createPaidAppointmentThroughLegacyApi();
  const actual = updateStatus(paid.id, "in-examination", {
    veterinarianId: "55555555-5555-4555-8555-555555555555",
  });

  expect(actual.status).toBe("paid");
});
