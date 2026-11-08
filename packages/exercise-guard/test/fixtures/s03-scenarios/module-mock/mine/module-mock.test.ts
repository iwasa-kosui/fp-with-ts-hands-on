import { expect, it, vi } from "vitest";

import { StartExaminationInput } from "../../../s03/exercises/guard/subjects/input.js";

const f = vi.fn().mockReturnValue(1);

it("テストファイルのトップレベルで作った vi.fn は、テストの中でも戻り値を保つ", () => {
  expect(StartExaminationInput).toBeDefined();
  expect(f()).toBe(1);
});
