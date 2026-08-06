import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (path: string): string =>
  readFileSync(new URL(path, import.meta.url), "utf8");

describe("session style vocabulary", () => {
  it("does not keep obsolete module selectors in active styles", () => {
    const activeStyles = [
      readSource("../../styles/base.css"),
      readSource("../../styles/sessions.css"),
    ].join("\n");

    expect(activeStyles).not.toMatch(/\.module(?:-|\b)/);
    expect(activeStyles).not.toMatch(/\[data-module(?:-|\])/);
    expect(activeStyles).not.toContain("前後のモジュール");
  });
});
