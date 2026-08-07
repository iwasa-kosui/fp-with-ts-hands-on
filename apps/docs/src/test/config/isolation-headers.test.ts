// @ts-ignore The docs TypeScript configuration intentionally excludes Node types.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isolationHeaders } from "../../../astro.config";

describe("cross-origin isolation headers", () => {
  it("keeps development, preview, session, and code explorer assets isolated", async () => {
    const staticHeaders = await readFile("public/_headers", "utf8");

    expect(isolationHeaders).toEqual({
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    for (const route of ["/sessions/*", "/code-explorer/*", "/_astro/*"]) {
      expect(staticHeaders).toContain(`${route}
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin`);
    }
  });
});
