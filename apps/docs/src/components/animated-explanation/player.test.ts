import { describe, expect, it } from "vitest";

import { resolveFrame } from "./player.js";

describe("resolveFrame", () => {
  const frames = [
    { show: "a b", hi: "a", place: { tok: "a" }, set: { label: "first" } },
    { hide: "a", hi: "b", place: { tok: "b" }, mark: { b: "ok" } },
  ];

  it("前のコマの表示、配置、文字を引き継ぎ、強調だけはそのコマのものにする", () => {
    const frame = resolveFrame(frames, 1);

    expect([...frame.shown]).toEqual(["b"]);
    expect([...frame.highlighted]).toEqual(["b"]);
    expect(frame.places).toEqual({ tok: "b" });
    expect(frame.texts).toEqual({ label: "first" });
    expect(frame.marks).toEqual({ b: "ok" });
  });

  it("前へ戻すと、後のコマの変更を含まない", () => {
    const frame = resolveFrame(frames, 0);

    expect([...frame.shown]).toEqual(["a", "b"]);
    expect(frame.places).toEqual({ tok: "a" });
    expect(frame.marks).toEqual({});
  });
});
