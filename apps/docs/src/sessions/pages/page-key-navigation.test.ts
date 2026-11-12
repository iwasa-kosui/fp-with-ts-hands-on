import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mountStepper } from "../../components/stepper/stepper";
import {
  installPageKeyNavigation,
  pageKeyDirection,
  pageKeyIgnoredSelector,
  pageKeyScope,
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
  repeat: false,
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
    ".code-explorer",
    ".guard-exercise",
    ".guard-answer",
  ])("%s の中では移動しない", (selector) => {
    expect(pageKeyIgnoredSelector.split(", ")).toContain(selector);
    expect(pageKeyDirection(keyEvent(), targetInside(selector))).toBeNull();
  });
});

describe("ファイルタブの上での左右キー", () => {
  it("CodeExplorer のファイルタブのボタンでは移動しない", () => {
    document.body.innerHTML = `
      <section class="code-explorer">
        <nav class="code-explorer__tabs"><button type="button" data-path="a.ts">a.ts</button></nav>
      </section>`;
    const tab = document.querySelector("button") as HTMLButtonElement;
    expect(pageKeyDirection(keyEvent(), tab)).toBeNull();
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
      progress: root.querySelector("[data-progress]") as HTMLElement,
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
    const { prev, progress, next, step } = mountThreeFrames();
    progress.focus();
    next.click();
    expect(step()).toBe(1);
    press(progress, "ArrowRight");
    expect(step()).toBe(2);
    press(progress, "ArrowLeft");
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
    const { prev, progress, next, step } = mountThreeFrames();
    progress.focus();
    press(progress, "ArrowLeft");
    expect(step()).toBe(0);
    next.click();
    next.click();
    expect(step()).toBe(2);
    press(progress, "ArrowRight");
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
    const { progress } = mountThreeFrames();
    expect(pageKeyDirection(keyEvent(), progress)).toBeNull();
  });
});

describe("場面を選ぶボタンでの左右キー", () => {
  const navigate = vi.fn<(direction: PageKeyDirection) => void>();

  beforeAll(() => {
    installPageKeyNavigation(document, navigate);
  });

  beforeEach(() => {
    navigate.mockClear();
  });

  const mountFigure = (withControls: boolean) => `
    <section data-step-figure>
      <button type="button" data-step-scene>場面</button>
      <div data-frame>1</div>
      <div data-frame>2</div>
      <div data-frame>3</div>
      ${
        withControls
          ? `<div data-controls hidden>
              <button type="button" data-prev>前へ</button>
              <button type="button" data-next>次へ</button>
              <span data-progress></span>
            </div>`
          : ""
      }
    </section>`;

  const mountScene = () => {
    document.body.innerHTML = mountFigure(true);
    const root = document.querySelector("section") as HTMLElement;
    mountStepper({ root });
    return {
      scene: root.querySelector("[data-step-scene]") as HTMLButtonElement,
      next: root.querySelector("[data-next]") as HTMLButtonElement,
      step: () => Number(root.dataset.step),
    };
  };

  const press = (
    element: Element,
    key: "ArrowLeft" | "ArrowRight",
    init: KeyboardEventInit = {},
  ) => {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
    element.dispatchEvent(event);
    return event;
  };

  it("ArrowRight でその図の次のコマへ1つだけ進み、ページは移動しない", () => {
    const { scene, step } = mountScene();
    scene.focus();
    const event = press(scene, "ArrowRight");
    expect(step()).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("ArrowLeft でその図の前のコマへ1つだけ戻り、ページは移動しない", () => {
    const { scene, next, step } = mountScene();
    next.click();
    next.click();
    expect(step()).toBe(2);
    scene.focus();
    press(scene, "ArrowLeft");
    expect(step()).toBe(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("コマが尽きているときは何もせず、ページも移動しない", () => {
    const { scene, next, step } = mountScene();
    scene.focus();
    press(scene, "ArrowLeft");
    expect(step()).toBe(0);
    next.click();
    next.click();
    expect(step()).toBe(2);
    expect(next.disabled).toBe(true);
    scene.focus();
    press(scene, "ArrowRight");
    expect(step()).toBe(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("同じ図に操作部が無いときは何も押されず、別の図の操作部も押さない", () => {
    document.body.innerHTML = `${mountFigure(false)}${mountFigure(true)}`;
    const [bare, other] = [...document.querySelectorAll("section")] as HTMLElement[];
    mountStepper({ root: other });
    const scene = bare.querySelector("[data-step-scene]") as HTMLButtonElement;
    scene.focus();
    press(scene, "ArrowRight");
    press(scene, "ArrowLeft");
    expect(other.dataset.step).toBe("0");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("図の外にある場面のボタンでは何もせず、ページも移動しない", () => {
    document.body.innerHTML = `
      <button type="button" data-step-scene>場面</button>
      ${mountFigure(true)}`;
    const root = document.querySelector("section") as HTMLElement;
    mountStepper({ root });
    const scene = document.querySelector("body > [data-step-scene]") as HTMLButtonElement;
    scene.focus();
    press(scene, "ArrowRight");
    expect(root.dataset.step).toBe("0");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("場面のボタンの中では、ページの移動の向きを返さない", () => {
    const { scene } = mountScene();
    expect(pageKeyDirection(keyEvent(), scene)).toBeNull();
  });

  it("押し続けて repeat になったキーでは、コマが進まず、ページも移動しない", () => {
    const { scene, next, step } = mountScene();
    scene.focus();
    const fromScene = press(scene, "ArrowRight", { repeat: true });
    expect(step()).toBe(0);
    expect(fromScene.defaultPrevented).toBe(true);
    next.focus();
    const fromControls = press(next, "ArrowRight", { repeat: true });
    expect(step()).toBe(0);
    expect(fromControls.defaultPrevented).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("操作部の外で押し続けたキーは、今までどおりページを移動する", () => {
    mountScene();
    press(document.body, "ArrowRight", { repeat: true });
    expect(navigate).toHaveBeenCalledWith("next");
  });
});

describe("pageKeyScope", () => {
  it("対象がないときと、本文や body の上ではページの移動を指す", () => {
    document.body.innerHTML = `<article><p id="text">本文</p></article>`;
    expect(pageKeyScope(null)).toBe("page");
    expect(pageKeyScope(document.body)).toBe("page");
    expect(pageKeyScope(document.getElementById("text"))).toBe("page");
  });

  it("図の操作部と図の場面のタブの上ではコマ送りを指す", () => {
    document.body.innerHTML = `
      <section data-step-figure>
        <button type="button" data-step-scene role="tab">場面</button>
        <div data-controls><button type="button" data-next>次のコマ</button></div>
      </section>`;
    expect(pageKeyScope(document.querySelector("[data-step-scene]"))).toBe("step");
    expect(pageKeyScope(document.querySelector("[data-next]"))).toBe("step");
  });

  it.each([
    ["input", `<input id="target" />`],
    ["textarea", `<textarea id="target"></textarea>`],
    ["select", `<select id="target"></select>`],
    ["contenteditable", `<div contenteditable="true"><span id="target"></span></div>`],
    [".monaco-editor", `<div class="monaco-editor"><span id="target"></span></div>`],
    [".xterm", `<div class="xterm"><span id="target"></span></div>`],
    [".code-explorer", `<div class="code-explorer"><span id="target"></span></div>`],
    [".guard-exercise", `<div class="guard-exercise"><span id="target"></span></div>`],
  ])("%s の中ではカーソルの移動を指す", (_name, html) => {
    document.body.innerHTML = html;
    expect(pageKeyScope(document.getElementById("target"))).toBe("text");
  });

  it("エディタの中に操作部があっても、カーソルの移動を指す", () => {
    document.body.innerHTML = `
      <div class="code-explorer"><div data-controls><button type="button" data-next>次</button></div></div>`;
    expect(pageKeyScope(document.querySelector("[data-next]"))).toBe("text");
  });

  it("pageKeyDirection と stepKeyButton の判定と食い違わない", () => {
    document.body.innerHTML = `
      <p id="plain">本文</p>
      <input id="field" />
      <section data-step-figure>
        <button type="button" data-step-scene>場面</button>
        <div data-controls><button type="button" data-next>次</button></div>
      </section>`;
    for (const id of ["plain", "field"]) {
      const element = document.getElementById(id) as HTMLElement;
      expect(pageKeyScope(element) === "page").toBe(pageKeyDirection(keyEvent(), element) !== null);
    }
    const scene = document.querySelector("[data-step-scene]") as HTMLElement;
    expect(pageKeyScope(scene) === "page").toBe(pageKeyDirection(keyEvent(), scene) !== null);
  });
});
