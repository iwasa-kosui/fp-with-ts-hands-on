import fc from "fast-check";
import { describe, it } from "vitest";

import { StartExaminationInput } from "../subjects/input.js";

describe("StartExaminationInput.parse", () => {
  it("文字列の ID を渡したときの性質", () => {
    fc.assert(
      fc.property(fc.string(), (id) => {
        const result = StartExaminationInput.parse({ appointmentId: id, veterinarianId: id });
        return result.isOk() || result.isErr();
      }),
    );
  });
});
