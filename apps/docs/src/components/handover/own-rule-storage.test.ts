import { beforeEach, describe, expect, it, vi } from "vitest";
import { load, momentLabel, save, STORAGE_KEY } from "./own-rule-storage";

describe("own-rule-storage", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    });
  });

  it("保存されていないとき、空の決まりを返す", () => {
    expect(load()).toEqual({ version: 1, rule: "" });
  });

  it("正常な保存値を読み込む", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, rule: "請求は1日1回まで", now: "human", goal: "write" }),
    );

    expect(load()).toEqual({ version: 1, rule: "請求は1日1回まで", now: "human", goal: "write" });
  });

  it("未回答の場面は含めない", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, rule: "決まり", goal: "test" }));

    expect(load()).toEqual({ version: 1, rule: "決まり", goal: "test" });
  });

  it("save した値を load で読み戻せる", () => {
    save({ version: 1, rule: "決まり", now: "run", goal: "test" });

    expect(load()).toEqual({ version: 1, rule: "決まり", now: "run", goal: "test" });
  });

  it("壊れた JSON は捨てて、空の決まりを返す", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    expect(load()).toEqual({ version: 1, rule: "" });
  });

  it.each(["null", "42", '"text"', "[]"])("形が違う保存値 %s は捨てて、空の決まりを返す", (raw) => {
    window.localStorage.setItem(STORAGE_KEY, raw);

    expect(load()).toEqual({ version: 1, rule: "" });
  });

  it("未知の場面の値と、文字列でない rule を捨てる", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, rule: 3, now: "magic", goal: 7 }),
    );

    expect(load()).toEqual({ version: 1, rule: "" });
  });

  it("場面の id から表示名を返す", () => {
    expect(momentLabel("write")).toBe("型検査のとき");
    expect(momentLabel("human")).toBe("人が気づくとき");
  });
});
