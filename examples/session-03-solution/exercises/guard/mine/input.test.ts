import fc from "fast-check";
import { describe, it } from "vitest";

import { StartExaminationInput } from "../subjects/input.js";

const rawInput = fc.record({
  appointmentId: fc.string(),
  veterinarianId: fc.string(),
});

describe("StartExaminationInput.parse", () => {
  it("文字列の ID を渡したときの性質", () => {
    fc.assert(
      fc.property(rawInput, (raw) => {
        const result = StartExaminationInput.parse(raw);
        // ここに検証する性質を実装します
        return true;
      }),
    );
  });
});
