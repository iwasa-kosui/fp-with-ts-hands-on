import { it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

it("解決しない Promise を待つ", async () => {
  void StartExaminationInput;
  await new Promise(() => {});
});
