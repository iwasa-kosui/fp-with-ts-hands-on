import { describe, expect, it } from "vitest";
import { guardExerciseWorkspaceFor } from "./guard-exercise-workspace";

const projectFiles = {
  "eslint.config.mjs": "export default [];",
  "exercises/guard/mine/input.test.ts": "// mine",
} as const;

describe("guardExerciseWorkspaceFor", () => {
  it("gives the same session the same key, apart from the session slug and other sessions", () => {
    const workspaceFor = (slug: string) =>
      guardExerciseWorkspaceFor(
        { slug, snapshot: "session-03-solution" },
        projectFiles,
        "演習の作業場所",
      );

    expect(workspaceFor("03-boundaries-and-pii").slug).toBe(
      workspaceFor("03-boundaries-and-pii").slug,
    );
    expect(workspaceFor("03-boundaries-and-pii").slug).not.toBe(
      "03-boundaries-and-pii",
    );
    expect(workspaceFor("03-boundaries-and-pii").slug).not.toBe(
      workspaceFor("04-workflow-errors").slug,
    );
  });

  it("throws when the snapshot has no files under exercises/guard/", () => {
    expect(() =>
      guardExerciseWorkspaceFor(
        { slug: "03-boundaries-and-pii", snapshot: "session-03-solution" },
        { "eslint.config.mjs": "export default [];" },
        "演習の作業場所",
      ),
    ).toThrow("session-03-solution");
  });
});
