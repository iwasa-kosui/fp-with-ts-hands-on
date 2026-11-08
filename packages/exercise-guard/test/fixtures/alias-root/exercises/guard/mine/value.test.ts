import { expect, it } from "vitest";

import { answer } from "@lib/answer";
import { value } from "../subjects/value.js";

it("答えは @lib/answer と同じ", () => {
  expect(value()).toBe(answer());
});
