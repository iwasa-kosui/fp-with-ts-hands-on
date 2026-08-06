// @ts-ignore The docs TypeScript configuration intentionally excludes Node types.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isolationHeaders } from "../../../astro.config";

describe("cross-origin isolation headers", () => {
  it("keeps development, preview, and future session assets isolated", async () => {
    const staticHeaders = await readFile("public/_headers", "utf8");

    expect(isolationHeaders).toEqual({
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    expect(staticHeaders).toContain("/sessions/*");
    expect(staticHeaders).toContain("Cross-Origin-Embedder-Policy: require-corp");
    expect(staticHeaders).toContain("Cross-Origin-Opener-Policy: same-origin");
  });
});
