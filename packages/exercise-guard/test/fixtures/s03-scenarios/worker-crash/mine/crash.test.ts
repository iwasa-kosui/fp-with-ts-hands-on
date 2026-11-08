import { expect, it } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

it("正しいコードのときだけプロセスが落ちる", () => {
  const rejected = StartExaminationInput.parse({
    appointmentId: "not-a-uuid",
    veterinarianId: "not-a-uuid",
  }).isErr();
  if (rejected) {
    process.kill(process.pid, "SIGKILL");
  }
  expect(rejected).toBe(false);
});
