import { describe, expect, it } from "vitest";
import {
  pageKeyDirection,
  pageKeyIgnoredSelector,
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
