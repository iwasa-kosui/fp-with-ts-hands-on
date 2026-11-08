import { describe, expect, it } from "vitest";

import { StartExaminationInput } from "../src/boundary/startExaminationInput.js";
import { handle } from "../src/web/startExaminationHandler.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";

describe("StartExaminationInput", () => {
  it("正しい ID は ok", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: validAppointment,
        veterinarianId: validVeterinarian,
      }).isOk(),
    ).toBe(true);
  });

  it("不正な ID は err", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: "invalid",
        veterinarianId: validVeterinarian,
      }).isErr(),
    ).toBe(true);
  });
});

describe("handle", () => {
  it("正しい本文はユースケースに渡す", async () => {
    const seen: unknown[] = [];
    const context = {
      req: { json: async () => ({ appointmentId: validAppointment, veterinarianId: validVeterinarian }) },
    };
    const response = await handle(context as never, (input) => {
      seen.push(input);
    });
    expect(response.status).toBe(200);
    expect(seen).toHaveLength(1);
  });
});
