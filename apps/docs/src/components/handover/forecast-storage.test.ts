import { beforeEach, describe, expect, it, vi } from "vitest";
import { load, save, STORAGE_KEY } from "./forecast-storage";

describe("forecast-storage", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    });
  });

  it("保存されていないとき、空の予想を返す", () => {
    expect(load()).toEqual({ version: 1, incidents: {} });
  });

  it("正常な保存値を読み込む", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        incidents: {
          "double-billing": { stage: "decide", mechanism: "write" },
          "pii-audit": { stage: "save" },
        },
      }),
    );

    expect(load()).toEqual({
      version: 1,
      incidents: {
        "double-billing": { stage: "decide", mechanism: "write" },
        "pii-audit": { stage: "save" },
      },
    });
  });

  it("save した値を load で読み戻せる", () => {
    const saved = {
      version: 1,
      incidents: { "pii-audit": { stage: "entry", mechanism: "test" } },
    } as const;

    save({ version: 1, incidents: { "pii-audit": { stage: "entry", mechanism: "test" } } });

    expect(load()).toEqual(saved);
  });

  it("壊れた JSON は捨てて、空の予想を返す", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");

    expect(load()).toEqual({ version: 1, incidents: {} });
  });

  it.each(["null", "42", '"text"', "{}", '{"incidents":null}', '{"incidents":"x"}'])(
    "形が違う保存値 %s は捨てて、空の予想を返す",
    (raw) => {
      window.localStorage.setItem(STORAGE_KEY, raw);

      expect(load()).toEqual({ version: 1, incidents: {} });
    },
  );

  it("未知の事故の id と、未知の値を捨てる", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        incidents: {
          unknown: { stage: "decide", mechanism: "write" },
          "double-billing": { stage: "nowhere", mechanism: "human" },
          "pii-audit": { stage: 3, mechanism: "magic" },
        },
      }),
    );

    expect(load()).toEqual({
      version: 1,
      incidents: {
        "double-billing": { mechanism: "human" },
        "pii-audit": {},
      },
    });
  });
});
