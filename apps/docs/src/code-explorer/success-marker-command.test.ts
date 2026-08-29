import { describe, expect, it } from "vitest";

import { withSuccessMarker } from "../../e2e/success-marker-command";

describe("withSuccessMarker", () => {
  it("keeps the completed marker out of echoed shell input", () => {
    const result = withSuccessMarker(
      "pnpm exercise:02",
      ["TYPECHECK_", "PASSED"],
    );

    expect(result.marker).toBe("TYPECHECK_PASSED");
    expect(result.command).not.toContain(result.marker);
    expect(result.command).toContain(
      "printf '%s%s\\n' 'TYPECHECK_' 'PASSED'",
    );
  });
});
