import { describe, expect, it } from "vitest";

import { nextStep, previousStep } from "./step-player.js";

describe("コマ送り", () => {
  it("最後のコマより先へ進まない", () => {
    expect(nextStep(1, 3)).toBe(2);
    expect(nextStep(2, 3)).toBe(2);
  });

  it("最初のコマより前へ戻らない", () => {
    expect(previousStep(1)).toBe(0);
    expect(previousStep(0)).toBe(0);
  });
});
