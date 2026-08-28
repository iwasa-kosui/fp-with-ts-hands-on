import { describe, expect, it } from "vitest";
import {
  canResetFile,
  createWorkspaceState,
  reduceWorkspaceState,
} from "./workspace-state";

const projectFiles = {
  "src/main.ts": "initial main",
  "src/secondary.ts": "initial secondary",
  "package.json": "{}",
} as const;

const createInitialState = () =>
  createWorkspaceState(
    projectFiles,
    ["src/main.ts", "src/secondary.ts"],
    "src/main.ts",
  );

describe("workspace state", () => {
  it("keeps edits while selecting files and resets only to an original file", () => {
    const edited = reduceWorkspaceState(createInitialState(), {
      kind: "edit",
      path: "src/main.ts",
      contents: "edited main",
    });
    const selected = reduceWorkspaceState(edited, {
      kind: "select",
      path: "src/secondary.ts",
    });
    const reset = reduceWorkspaceState(selected, {
      kind: "reset",
      path: "src/main.ts",
      contents: projectFiles["src/main.ts"],
    });

    expect(edited.contents["src/main.ts"]).toBe("edited main");
    expect(selected.selectedPath).toBe("src/secondary.ts");
    expect(reset.contents["src/main.ts"]).toBe("initial main");
    expect(canResetFile(projectFiles, "src/main.ts")).toBe(true);
    expect(canResetFile(projectFiles, "src/created.ts")).toBe(false);
    expect(canResetFile(projectFiles, undefined)).toBe(false);
  });

  it("adds external text files in stable tree order and updates their contents", () => {
    const created = reduceWorkspaceState(createInitialState(), {
      kind: "external-write",
      path: "src/created.ts",
      contents: "created",
    });
    const updated = reduceWorkspaceState(created, {
      kind: "external-write",
      path: "src/created.ts",
      contents: "updated",
    });

    expect(created.visiblePaths).toEqual([
      "src/created.ts",
      "src/main.ts",
      "src/secondary.ts",
    ]);
    expect(updated.contents["src/created.ts"]).toBe("updated");
  });

  it("keeps the same state object for an identical external write", () => {
    const initial = createInitialState();

    expect(
      reduceWorkspaceState(initial, {
        kind: "external-write",
        path: "src/main.ts",
        contents: "initial main",
      }),
    ).toBe(initial);
  });

  it("selects the first remaining file when the selected file is deleted", () => {
    const created = reduceWorkspaceState(createInitialState(), {
      kind: "external-write",
      path: "src/created.ts",
      contents: "created",
    });
    const selected = reduceWorkspaceState(created, {
      kind: "select",
      path: "src/created.ts",
    });
    const deleted = reduceWorkspaceState(selected, {
      kind: "external-delete",
      path: "src/created.ts",
    });

    expect(deleted.visiblePaths).toEqual(["src/main.ts", "src/secondary.ts"]);
    expect(deleted.contents["src/created.ts"]).toBeUndefined();
    expect(deleted.selectedPath).toBe("src/main.ts");
  });

  it("uses an empty selection when the last visible file is deleted", () => {
    const onlyFile = createWorkspaceState(
      { "src/main.ts": "initial main" },
      ["src/main.ts"],
      "src/main.ts",
    );

    expect(
      reduceWorkspaceState(onlyFile, {
        kind: "external-delete",
        path: "src/main.ts",
      }),
    ).toEqual({ contents: {}, visiblePaths: [], selectedPath: undefined });
  });
});
