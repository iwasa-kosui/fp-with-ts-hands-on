import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notUuid = fc.string().filter((value) => !uuidLike.test(value));

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

  it("不正な予約 ID は err", () => {
    fc.assert(
      fc.property(notUuid, (id) =>
        StartExaminationInput.parse({ appointmentId: id, veterinarianId: validVeterinarian }).isErr(),
      ),
      { numRuns: 50 },
    );
  });

  it("不正な獣医師 ID は err", () => {
    fc.assert(
      fc.property(notUuid, (id) =>
        StartExaminationInput.parse({ appointmentId: validAppointment, veterinarianId: id }).isErr(),
      ),
      { numRuns: 50 },
    );
  });
});
