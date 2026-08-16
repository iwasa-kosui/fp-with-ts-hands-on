// @ts-ignore The docs TypeScript configuration intentionally excludes Node types.
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import astroConfig, { isolationHeaders } from "../../../astro.config";

describe("cross-origin isolation headers", () => {
  it("keeps development, preview, and session playground assets isolated", async () => {
    const staticHeaders = await readFile("public/_headers", "utf8");

    expect(isolationHeaders).toEqual({
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
    expect(astroConfig).toMatchObject({
      server: { headers: isolationHeaders },
    });
    expect(staticHeaders).toContain(`/sessions/*
  Cross-Origin-Embedder-Policy: require-corp
  Cross-Origin-Opener-Policy: same-origin`);
    expect(staticHeaders).not.toContain("/code-explorer/*");
  });
});
