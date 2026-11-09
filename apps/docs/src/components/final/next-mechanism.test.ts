import { beforeEach, describe, expect, it, vi } from "vitest";
import { findWhat, findWhere, load, save, STORAGE_KEY, whats, wheres } from "./next-mechanism";

describe("next-mechanism", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    });
  });

  it("保存されていないとき、何も選んでいない状態を返す", () => {
    expect(load()).toEqual({});
  });

  it("save した選択を load で読み戻せる", () => {
    save({ what: "required-checks", where: "ci" });

    expect(load()).toEqual({ what: "required-checks", where: "ci" });
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "")).toEqual({
      version: 1,
      what: "required-checks",
      where: "ci",
    });
  });

  it("仕組みだけを選んだ状態を保存して読み戻せる", () => {
    save({ what: "as-lint" });

    expect(load()).toEqual({ what: "as-lint" });
  });

  it("壊れた JSON は捨てる", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    expect(load()).toEqual({});
  });

  it.each(["null", "42", '"text"', "[]"])("形が違う保存値 %s は捨てる", (raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);

    expect(load()).toEqual({});
  });

  it("未知の id と、文字列でない値を捨てて、読める項目だけ残す", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, what: "unknown", where: "pre-commit" }),
    );
    expect(load()).toEqual({ where: "pre-commit" });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, what: 3, where: ["ci"] }));
    expect(load()).toEqual({});
  });

  it("推奨の where は、定義済みの where を指す", () => {
    for (const what of whats) {
      if (what.recommended === undefined) continue;
      expect(findWhere(what.recommended)).toBeDefined();
    }
    expect(wheres).toHaveLength(4);
    expect(findWhat("agent-context")?.recommended).toBeUndefined();
  });
});
