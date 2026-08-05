import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startApp } from "./app";

const runningApps: Array<() => void> = [];

const start = (root: HTMLElement): (() => void) => {
  const stop = startApp(root, window);
  runningApps.push(stop);
  return stop;
};

const dispatchClick = (
  target: Element,
  init: MouseEventInit = {},
): MouseEvent => {
  const event = new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
};

describe("startApp", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const stop of runningApps.splice(0)) stop();
    vi.restoreAllMocks();
  });

  it("初回の通常パスと未知のパスを対応するページとして描画する", () => {
    window.history.replaceState({}, "", "/modules/01-state-modeling/");
    const root = document.createElement("div");
    start(root);

    expect(root.querySelector("h1")?.textContent).toContain("状態遷移を型にする");

    window.history.replaceState({}, "", "/missing/");
    const missingRoot = document.createElement("div");
    start(missingRoot);

    expect(missingRoot.textContent).toContain("ページが見つかりません");
  });

  it("互換ルートを置換し、アプリ内リンクと popstate で再描画する", () => {
    window.history.replaceState({}, "", "/module-00/");
    const root = document.createElement("div");
    start(root);

    expect(window.location.pathname).toBe("/modules/00-break-the-app/");

    const next = root.querySelector<HTMLAnchorElement>('[rel="next"]');
    expect(next).not.toBeNull();
    next?.click();
    expect(window.location.pathname).toBe("/modules/00-read-the-incident/");

    window.history.back();
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(root.querySelector("h1")?.textContent).toContain("導入事故");
  });

  it("左クリックかつ修飾キーなしの同一 origin・target なしリンクだけを横取りする", () => {
    window.history.replaceState({}, "", "/");
    const root = document.createElement("div");
    start(root);

    const pushState = vi.spyOn(window.history, "pushState");
    const intercepted: boolean[] = [];
    root.addEventListener("click", (event) => {
      intercepted.push(event.defaultPrevented);
      event.preventDefault();
    });
    const cases: ReadonlyArray<
      Readonly<{
        href: string;
        target?: string;
        download?: string;
        init?: MouseEventInit;
      }>
    > = [
      { href: "/modules/01-state-modeling/", init: { button: 1 } },
      { href: "/modules/01-state-modeling/", init: { metaKey: true } },
      { href: "/modules/01-state-modeling/", init: { ctrlKey: true } },
      { href: "/modules/01-state-modeling/", init: { shiftKey: true } },
      { href: "/modules/01-state-modeling/", init: { altKey: true } },
      { href: "https://example.com/modules/01-state-modeling/" },
      { href: "/modules/01-state-modeling/", target: "_blank" },
      { href: "/modules/01-state-modeling/", download: "module.html" },
    ];

    for (const testCase of cases) {
      const anchor = document.createElement("a");
      anchor.href = testCase.href;
      if (testCase.target !== undefined) anchor.target = testCase.target;
      if (testCase.download !== undefined) anchor.download = testCase.download;
      root.append(anchor);
      dispatchClick(anchor, testCase.init);
      expect(intercepted.at(-1)).toBe(false);
    }
    expect(pushState).not.toHaveBeenCalled();

    const internal = document.createElement("a");
    internal.href = "/modules/01-state-modeling/";
    const child = document.createElement("span");
    internal.append(child);
    root.append(internal);
    dispatchClick(child);

    expect(intercepted.at(-1)).toBe(true);
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/modules/01-state-modeling/");
    expect(root.querySelector("h1")?.textContent).toContain("状態遷移を型にする");
  });

  it("描画ごとに先頭へ移動して見出しへフォーカスし、cleanup 後は再描画しない", () => {
    window.history.replaceState({}, "", "/modules/01-state-modeling/");
    const root = document.createElement("div");
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    const stop = start(root);

    const initialHeading = root.querySelector("h1");
    expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0 });
    expect(focus).toHaveBeenLastCalledWith();
    expect(focus.mock.instances.at(-1)).toBe(initialHeading);

    stop();
    window.history.replaceState({}, "", "/missing/");
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(root.querySelector("h1")?.textContent).toContain("状態遷移を型にする");

    const detachedLink = root.querySelector<HTMLAnchorElement>('[rel="next"]');
    const pushState = vi.spyOn(window.history, "pushState");
    if (detachedLink === null) throw new Error("next link is missing");
    dispatchClick(detachedLink);
    expect(pushState).not.toHaveBeenCalled();
  });
});
