export type PageKeyDirection = "previous" | "next";

export type PageKeyEvent = Readonly<{
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  defaultPrevented: boolean;
}>;

export type PageKeyTarget = Readonly<{
  closest: (selector: string) => unknown;
}>;

export const pageKeyIgnoredSelector = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  '[role="tab"]',
  '[role="slider"]',
  ".monaco-editor",
  ".xterm",
  ".guard-answer__panel",
].join(", ");

export const pageKeyDirection = (
  event: PageKeyEvent,
  target: PageKeyTarget | null,
): PageKeyDirection | null => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.defaultPrevented) return null;
  if (target !== null && target.closest(pageKeyIgnoredSelector) !== null) return null;
  return event.key === "ArrowLeft" ? "previous" : "next";
};
