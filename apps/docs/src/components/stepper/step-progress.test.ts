import { describe, expect, it } from "vitest";
import { renderProgress } from "./step-progress";

describe("renderProgress", () => {
  const render = (index: number, total: number) => {
    const progress = document.createElement("span");
    renderProgress(progress, index, total);
    return progress;
  };

  it("「現在 / 全体」の文字を出す", () => {
    expect(render(1, 5).textContent).toBe("2 / 5");
  });

  it("全体の数だけ区切りを描き、現在までの区切りに data-on を付ける", () => {
    const segs = [...render(2, 5).querySelectorAll(".step-progress__seg")];
    expect(segs).toHaveLength(5);
    expect(segs.map((seg) => seg.hasAttribute("data-on"))).toEqual([true, true, true, false, false]);
  });

  it("8コマまでは区切りを8個描く", () => {
    const bar = render(0, 8).querySelector(".step-progress__bar") as HTMLElement;
    expect(bar.querySelectorAll(".step-progress__seg")).toHaveLength(8);
    expect(bar.hasAttribute("data-continuous")).toBe(false);
  });

  it("9コマ以上は区切りを作らず、fill 1つの幅が割合になる", () => {
    const progress = render(2, 12);
    const bar = progress.querySelector(".step-progress__bar") as HTMLElement;
    expect(bar.hasAttribute("data-continuous")).toBe(true);
    expect(bar.querySelectorAll(".step-progress__seg")).toHaveLength(0);
    const fills = bar.querySelectorAll<HTMLElement>(".step-progress__fill");
    expect(fills).toHaveLength(1);
    expect(fills[0]?.style.width).toBe("25%");
    expect(progress.textContent).toBe("3 / 12");
  });

  it("棒は支援技術に読み上げさせない", () => {
    expect(render(0, 3).querySelector(".step-progress__bar")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("呼び直すと前の描画を置き換える", () => {
    const progress = render(0, 3);
    renderProgress(progress, 2, 3);
    expect(progress.querySelectorAll(".step-progress__bar")).toHaveLength(1);
    expect(progress.textContent).toBe("3 / 3");
  });
});
