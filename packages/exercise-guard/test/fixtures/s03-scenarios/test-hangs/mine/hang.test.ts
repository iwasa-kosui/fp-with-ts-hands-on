import { it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

it("終わらない", () => {
  void StartExaminationInput;
  while (true) {}
});
