import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";

describe("StartExaminationInput.parse", () => {
  it("任意の入力で throw せず ok か err を返す", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const result = StartExaminationInput.parse(raw);
        return result.isOk() !== result.isErr();
      }),
      { numRuns: 100 },
    );
  });

  it("正しい ID は ok", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: validAppointment,
        veterinarianId: validVeterinarian,
      }).isOk(),
    ).toBe(true);
  });
});
