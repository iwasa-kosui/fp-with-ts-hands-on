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

export const stepControlsSelector = "[data-controls]";

export type StepButton = Readonly<{
  click: () => void;
  disabled?: boolean;
}>;

export type StepKey = Readonly<{
  button: StepButton | null;
}>;

const arrowDirection = (event: PageKeyEvent): PageKeyDirection | null => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return null;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (event.defaultPrevented) return null;
  return event.key === "ArrowLeft" ? "previous" : "next";
};

export const pageKeyDirection = (
  event: PageKeyEvent,
  target: PageKeyTarget | null,
): PageKeyDirection | null => {
  const direction = arrowDirection(event);
  if (direction === null) return null;
  if (target !== null && target.closest(pageKeyIgnoredSelector) !== null) return null;
  if (target !== null && target.closest(stepControlsSelector) !== null) return null;
  return direction;
};

const hasMethod = (value: unknown, name: string): boolean =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>)[name] === "function";

export const stepKeyButton = (
  event: PageKeyEvent,
  target: PageKeyTarget | null,
): StepKey | null => {
  const direction = arrowDirection(event);
  if (direction === null || target === null) return null;
  if (target.closest(pageKeyIgnoredSelector) !== null) return null;
  const controls = target.closest(stepControlsSelector);
  if (!hasMethod(controls, "querySelector")) return null;
  const found = (controls as ParentNode).querySelector(
    direction === "next" ? "[data-next]" : "[data-prev]",
  );
  return { button: hasMethod(found, "click") ? (found as unknown as StepButton) : null };
};

const isDisabledButton = (element: Element): boolean =>
  (element as Partial<HTMLButtonElement>).disabled === true;

export const focusEnabledControl = (disabledButton: Element): void => {
  const controls = disabledButton.closest(stepControlsSelector);
  if (controls === null) return;
  const opposite = controls.querySelector<HTMLButtonElement>(
    disabledButton.matches("[data-next]") ? "[data-prev]" : "[data-next]",
  );
  const candidates = [opposite, ...controls.querySelectorAll<HTMLButtonElement>("button")];
  candidates
    .find((candidate) => candidate !== null && !candidate.disabled && !candidate.hidden)
    ?.focus({ preventScroll: true });
};

export const installPageKeyNavigation = (
  doc: Document,
  navigate: (direction: PageKeyDirection) => void,
): void => {
  let stepping = false;

  const controlButton = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(`${stepControlsSelector} button`) : null;

  const leaveDisabled = (button: Element | null) => {
    if (button !== null && isDisabledButton(button)) focusEnabledControl(button);
  };

  doc.addEventListener("keydown", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const step = stepKeyButton(event, target);
    if (step !== null) {
      event.preventDefault();
      if (step.button !== null && step.button.disabled !== true) {
        stepping = true;
        try {
          step.button.click();
        } finally {
          stepping = false;
        }
      }
    } else {
      const direction = pageKeyDirection(event, target);
      if (direction !== null) navigate(direction);
    }
    leaveDisabled(controlButton(target));
  });

  doc.addEventListener("click", (event) => {
    if (stepping) return;
    const button = controlButton(event.target);
    if (button === null) return;
    if (isDisabledButton(button)) focusEnabledControl(button);
    else button.focus({ preventScroll: true });
  });

  new MutationObserver((records) => {
    for (const record of records) {
      if (record.target instanceof Element && doc.activeElement === record.target) {
        leaveDisabled(record.target);
      }
    }
  }).observe(doc.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled"],
  });
};
