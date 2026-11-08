import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { StartExaminationInput } from "../../subjects/input.js";

const validAppointment = "11111111-1111-4111-8111-111111111111";
const validVeterinarian = "44444444-4444-4444-8444-444444444444";
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notUuid = fc.string().filter((value) => !uuidLike.test(value));

describe("StartExaminationInput.parse", () => {
  it("任意の値で throw せず、ok か err を返す", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const result = StartExaminationInput.parse(raw);
        return result.isOk() !== result.isErr();
      }),
      { numRuns: 100 },
    );
  });

  it("UUID の ID は ok", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (appointmentId, veterinarianId) =>
        StartExaminationInput.parse({ appointmentId, veterinarianId }).isOk(),
      ),
      { numRuns: 50 },
    );
  });

  it("UUID でない予約 ID は err", () => {
    fc.assert(
      fc.property(notUuid, (id) =>
        StartExaminationInput.parse({ appointmentId: id, veterinarianId: validVeterinarian }).isErr(),
      ),
      { numRuns: 50 },
    );
  });

  it("UUID でない獣医師 ID は err", () => {
    fc.assert(
      fc.property(notUuid, (id) =>
        StartExaminationInput.parse({ appointmentId: validAppointment, veterinarianId: id }).isErr(),
      ),
      { numRuns: 50 },
    );
  });

  it("正しい ID は、渡した値のまま取り出せる", () => {
    expect(
      StartExaminationInput.parse({
        appointmentId: validAppointment,
        veterinarianId: validVeterinarian,
      })._unsafeUnwrap(),
    ).toEqual({ appointmentId: validAppointment, veterinarianId: validVeterinarian });
  });
});
