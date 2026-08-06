import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const baseStyles = readFileSync(resolve("src/styles/base.css"), "utf8");

describe("base session styles", () => {
  it("does not expose legacy module selectors for session navigation", () => {
    expect(baseStyles).toContain(".session-navigation");
    expect(baseStyles).toContain('aria-label="前後のセッション"');
    expect(baseStyles).not.toContain(".module-navigation");
    expect(baseStyles).not.toContain('aria-label="前後のモジュール"');
  });
});
