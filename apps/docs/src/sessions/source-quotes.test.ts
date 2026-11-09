import { describe, expect, it } from "vitest";
import { lineLabelOf, pathLabelOf } from "./source-quotes";

const path = "src/domain/appointment/statusLabel.ts";
const importLine = 'import type { Appointment } from "./appointment.js";';
const assertNeverStart = "const assertNever = (value: never): never => {";

describe("pathLabelOf", () => {
  it("prefixes the path with the snapshot directory", () => {
    expect(pathLabelOf("session-02-solution", path)).toBe(
      `examples/session-02-solution/${path}`,
    );
  });

  it("rejects a path that is not in the snapshot", () => {
    expect(() => pathLabelOf("session-02-solution", "src/missing.ts")).toThrow(
      "src/missing.ts is not in the snapshot",
    );
  });
});

describe("lineLabelOf", () => {
  it("returns a one-based range from the first to the last line", () => {
    expect(lineLabelOf("session-02-solution", path, assertNeverStart, "};")).toBe(
      `examples/session-02-solution/${path}:3-5`,
    );
  });

  it("returns a single line number when both lines are the same", () => {
    expect(lineLabelOf("session-02-solution", path, importLine, importLine)).toBe(
      `examples/session-02-solution/${path}:1`,
    );
  });

  it("rejects a block that is not in the file", () => {
    expect(() =>
      lineLabelOf("session-02-solution", path, "no such line", "};"),
    ).toThrow(`${path} has no block from "no such line" to "};"`);
  });

  it("rejects a path that is not in the snapshot", () => {
    expect(() =>
      lineLabelOf("session-02-solution", "src/missing.ts", "a", "b"),
    ).toThrow("src/missing.ts is not in the snapshot");
  });
});
