import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
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

    await store.saveView({
      slug: "s",
      output: "hello",
      lastOutputAt: 10,
      selectedPath: "src/a.ts",
    });
    const loaded = await store.load("s");

    expect(loaded.workspace).toBeUndefined();
    expect(loaded.view).toEqual({
      slug: "s",
      output: "hello",
      lastOutputAt: 10,
      selectedPath: "src/a.ts",
    });
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
});
