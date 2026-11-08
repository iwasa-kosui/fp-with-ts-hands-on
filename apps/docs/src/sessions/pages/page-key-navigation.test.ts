import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mountStepper } from "../../components/stepper/stepper";
import {
  installPageKeyNavigation,
  pageKeyDirection,
  pageKeyIgnoredSelector,
  type PageKeyDirection,
  type PageKeyEvent,
  type PageKeyTarget,
} from "./page-key-navigation";

const keyEvent = (overrides: Partial<PageKeyEvent> = {}): PageKeyEvent => ({
  key: "ArrowRight",
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  defaultPrevented: false,
  ...overrides,
});

const targetInside = (selector: string): PageKeyTarget => ({
  closest: (candidates) =>
    candidates.split(", ").includes(selector) ? {} : null,
});

const plainTarget: PageKeyTarget = { closest: () => null };

describe("pageKeyDirection", () => {
  it("ArrowLeft は前のページ、ArrowRight は次のページを指す", () => {
    expect(pageKeyDirection(keyEvent({ key: "ArrowLeft" }), plainTarget)).toBe("previous");
    expect(pageKeyDirection(keyEvent({ key: "ArrowRight" }), plainTarget)).toBe("next");
  });

  it("対象がない場合も移動する", () => {
    expect(pageKeyDirection(keyEvent(), null)).toBe("next");
  });

  it("矢印キー以外では移動しない", () => {
    for (const key of ["ArrowUp", "ArrowDown", "a", "Enter", "Tab"]) {
      expect(pageKeyDirection(keyEvent({ key }), plainTarget), key).toBeNull();
    }
  });

  it.each(["altKey", "ctrlKey", "metaKey", "shiftKey"] as const)(
    "%s を押している間は移動しない",
    (modifier) => {
      expect(pageKeyDirection(keyEvent({ [modifier]: true }), plainTarget)).toBeNull();
    },
  );

  it("defaultPrevented のイベントでは移動しない", () => {
    expect(pageKeyDirection(keyEvent({ defaultPrevented: true }), plainTarget)).toBeNull();
  });

  it.each([
    "input",
    "textarea",
    "select",
    "[contenteditable]",
    '[role="tab"]',
    '[role="slider"]',
    ".monaco-editor",
    ".xterm",
    ".guard-answer__panel",
  ])("%s の中では移動しない", (selector) => {
    expect(pageKeyIgnoredSelector.split(", ")).toContain(selector);
    expect(pageKeyDirection(keyEvent(), targetInside(selector))).toBeNull();
  });
});

describe("コマ送りの操作部の中での左右キー", () => {
  const navigate = vi.fn<(direction: PageKeyDirection) => void>();

  beforeAll(() => {
    installPageKeyNavigation(document, navigate);
  });

  beforeEach(() => {
    navigate.mockClear();
  });

  const mountThreeFrames = () => {
    document.body.innerHTML = `
      <p id="outside">本文</p>
      <section id="root">
        <div data-frame>1</div>
        <div data-frame>2</div>
        <div data-frame>3</div>
        <div data-controls hidden>
          <button type="button" data-prev>前へ</button>
          <button type="button" data-play>再生</button>
          <button type="button" data-next>次へ</button>
          <span data-progress></span>
        </div>
      </section>`;
    const root = document.getElementById("root") as HTMLElement;
    mountStepper({ root });
    const button = (selector: string) => root.querySelector(selector) as HTMLButtonElement;
    return {
      outside: document.getElementById("outside") as HTMLElement,
      prev: button("[data-prev]"),
      play: button("[data-play]"),
      next: button("[data-next]"),
      step: () => Number(root.dataset.step),
    };
  };

  const press = (element: Element, key: "ArrowLeft" | "ArrowRight") => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  };

  it("「次へ」のあとの ArrowRight でコマが1つだけ進み、ページは移動しない", () => {
    const { next, step } = mountThreeFrames();
    next.focus();
    next.click();
    expect(step()).toBe(1);
    press(next, "ArrowRight");
    expect(step()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ボタンとキーを交互に使っても、1回の操作で1コマずつ進む", () => {
    const { prev, play, next, step } = mountThreeFrames();
    play.focus();
    next.click();
    expect(step()).toBe(1);
    press(play, "ArrowRight");
    expect(step()).toBe(2);
    press(play, "ArrowLeft");
    expect(step()).toBe(1);
    prev.click();
    expect(step()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ArrowLeft は「前へ」と同じに動く", () => {
    const { prev, next, step } = mountThreeFrames();
    next.click();
    next.click();
    prev.focus();
    press(prev, "ArrowLeft");
    expect(step()).toBe(1);
    press(prev, "ArrowLeft");
    expect(step()).toBe(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("最後のコマの ArrowRight と最初のコマの ArrowLeft は何もしない", () => {
    const { prev, play, next, step } = mountThreeFrames();
    play.focus();
    press(play, "ArrowLeft");
    expect(step()).toBe(0);
    next.click();
    next.click();
    expect(step()).toBe(2);
    press(play, "ArrowRight");
    expect(step()).toBe(2);
    prev.focus();
    press(prev, "ArrowRight");
    expect(step()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("キーで最後のコマに進んで「次へ」が無効になると、フォーカスは同じ操作部の有効なボタンへ移る", () => {
    const { prev, next } = mountThreeFrames();
    next.focus();
    press(next, "ArrowRight");
    press(next, "ArrowRight");
    expect(next.disabled).toBe(true);
    expect(document.activeElement).toBe(prev);
    press(document.activeElement as Element, "ArrowRight");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("クリックで最後のコマに進んで「次へ」が無効になると、フォーカスは同じ操作部の有効なボタンへ移る", () => {
    const { prev, next } = mountThreeFrames();
    next.focus();
    next.click();
    next.click();
    expect(next.disabled).toBe(true);
    expect(document.activeElement).toBe(prev);
  });

  it("操作部の外では、ページの移動の向きが返る", () => {
    const { outside } = mountThreeFrames();
    press(outside, "ArrowRight");
    press(outside, "ArrowLeft");
    expect(navigate.mock.calls.map(([direction]) => direction)).toEqual(["next", "previous"]);
    expect(pageKeyDirection(keyEvent(), outside)).toBe("next");
  });

  it("操作部の中では、ページの移動の向きを返さない", () => {
    const { play } = mountThreeFrames();
    expect(pageKeyDirection(keyEvent(), play)).toBeNull();
  });
});
