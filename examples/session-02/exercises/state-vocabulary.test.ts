import { expect, it } from "vitest";

it("状態ごとに必要な情報を型で表現できる", async () => {
  const { states } = await import("../src/domain/appointment-state.js");

  expect(states).toEqual(["Scheduled", "CheckedIn", "InExamination"]);
});
