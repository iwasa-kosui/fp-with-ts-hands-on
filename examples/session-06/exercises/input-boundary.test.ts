import { expect, it } from "vitest";

it("外部から来た予約入力は状態モデルへ渡す前に検証する", async () => {
  const { parseAppointmentInput } = await import(
    "../src/boundary/appointment-input.js"
  );
  const rawInput = {
    appointmentId: 123,
    petId: "pet-1",
    ownerId: "owner-1",
    scheduledAt: "not-a-timestamp",
  };

  expect(parseAppointmentInput(rawInput)).toEqual({
    ok: false,
    reason: "invalid-input",
  });
});
