import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { sampleGuardResult } from "./guard-result.fixture";
import { createIndexedDbWorkspaceStore } from "./workspace-store";

const edits = {
  "src/a.ts": { contents: "const a = 2;", base: "const a = 1;" },
};

describe("IndexedDB workspace store", () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it("returns nothing for a slug that was never saved", async () => {
    const store = createIndexedDbWorkspaceStore();

    expect(await store.load("01-state-transitions")).toEqual({});
  });

  it("saves edits with an increasing revision and reads them back", async () => {
    const store = createIndexedDbWorkspaceStore();

    const first = await store.saveEdits("s", edits, 0);
    const second = await store.saveEdits("s", {}, 1);
    const loaded = await store.load("s");

    expect(first).toEqual({ kind: "saved", revision: 1 });
    expect(second).toEqual({ kind: "saved", revision: 2 });
    expect(loaded.workspace?.revision).toBe(2);
    expect(loaded.workspace?.edits).toEqual({});
  });

  it("reports a conflict without writing when the expected revision differs", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveEdits("s", edits, 0);

    const result = await store.saveEdits("s", {}, 0);
    const loaded = await store.load("s");

    expect(result).toEqual({ kind: "conflict", revision: 1 });
    expect(loaded.workspace?.edits).toEqual(edits);
    expect(loaded.workspace?.revision).toBe(1);
  });

  it("saves and reads the terminal view separately from the edits", async () => {
    const store = createIndexedDbWorkspaceStore();

    await store.saveTerminalOutput("s", "hello", 10);
    await store.saveSelectedPath("s", "src/a.ts");
    const loaded = await store.load("s");

    expect(loaded.workspace).toBeUndefined();
    expect(loaded.view).toEqual({
      slug: "s",
      output: "hello",
      lastOutputAt: 10,
      selectedPath: "src/a.ts",
    });
  });

  it("keeps the output when only the selected path is saved", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveTerminalOutput("s", "hello", 10);

    await store.saveSelectedPath("s", "src/b.ts");

    expect((await store.load("s")).view).toEqual({
      slug: "s",
      output: "hello",
      lastOutputAt: 10,
      selectedPath: "src/b.ts",
    });
  });

  it("keeps the selected path when only the output is saved", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveSelectedPath("s", "src/b.ts");
    expect((await store.load("s")).view).toEqual({
      slug: "s",
      output: "",
      lastOutputAt: 0,
      selectedPath: "src/b.ts",
    });

    await store.saveTerminalOutput("s", "later", 20);

    expect((await store.load("s")).view).toEqual({
      slug: "s",
      output: "later",
      lastOutputAt: 20,
      selectedPath: "src/b.ts",
    });
  });

  it("saves over a missing record instead of reporting a conflict", async () => {
    const store = createIndexedDbWorkspaceStore();

    const result = await store.saveEdits("s", edits, 4);

    expect(result).toEqual({ kind: "saved", revision: 5 });
    expect((await store.load("s")).workspace?.revision).toBe(5);
  });

  it("keeps slugs independent", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveEdits("one", edits, 0);

    expect((await store.load("two")).workspace).toBeUndefined();
  });

  it("notifies other stores of a saved revision for the same slug", async () => {
    const writer = createIndexedDbWorkspaceStore();
    const reader = createIndexedDbWorkspaceStore();
    const received: number[] = [];
    const unsubscribe = reader.subscribe("s", (revision) => {
      received.push(revision);
    });
    reader.subscribe("other", () => received.push(-1));

    await writer.saveEdits("s", edits, 0);
    await new Promise((resolve) => setTimeout(resolve, 20));
    unsubscribe();

    expect(received).toEqual([1]);
  });
  it("restores the guard result and the limitations with a new store", async () => {
    await createIndexedDbWorkspaceStore().saveGuardResult(
      "s",
      sampleGuardResult,
      20,
    );
    await createIndexedDbWorkspaceStore().saveLimitations("s", {
      "B1-any-parser": "別の書き方は検出できない",
    });

    const loaded = await createIndexedDbWorkspaceStore().load("s");

    expect(loaded.view?.guardResult).toEqual(sampleGuardResult);
    expect(loaded.view?.guardRanAt).toBe(20);
    expect(loaded.view?.limitations).toEqual({
      "B1-any-parser": "別の書き方は検出できない",
    });
  });

  it("keeps the guard result when the terminal output and the selected path are saved", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveGuardResult("s", sampleGuardResult, 20);

    await store.saveTerminalOutput("s", "hello", 30);
    await store.saveSelectedPath("s", "src/a.ts");

    const view = (await store.load("s")).view;
    expect(view?.guardResult).toEqual(sampleGuardResult);
    expect(view?.output).toBe("hello");
    expect(view?.selectedPath).toBe("src/a.ts");
  });

  it("keeps the output and the guard result when the limitations are saved", async () => {
    const store = createIndexedDbWorkspaceStore();
    await store.saveTerminalOutput("s", "hello", 30);
    await store.saveGuardResult("s", sampleGuardResult, 40);

    await store.saveLimitations("s", { a: "b" });

    const view = (await store.load("s")).view;
    expect(view?.output).toBe("hello");
    expect(view?.guardResult).toEqual(sampleGuardResult);
    expect(view?.limitations).toEqual({ a: "b" });
  });
});
