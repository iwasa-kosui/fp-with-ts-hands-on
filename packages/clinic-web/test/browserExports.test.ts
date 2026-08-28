import { describe, expect, it } from "vitest";

import * as browserExports from "../src/index.js";

describe("browser exports", () => {
  it("Node専用のroot viewとVite configを公開しない", () => {
    expect(browserExports).not.toHaveProperty("createClinicRootView");
    expect(browserExports).not.toHaveProperty("createClinicViteConfig");
  });
});
