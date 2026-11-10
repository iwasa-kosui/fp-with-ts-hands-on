const storageKey = (): string =>
  `fp-with-ts:guard-terminal-open:${window.location.pathname}`;

export const loadTerminalOpen = (): boolean => {
  try {
    return window.localStorage.getItem(storageKey()) === "open";
  } catch {
    return false;
  }
};

export const saveTerminalOpen = (open: boolean): void => {
  try {
    if (open) {
      window.localStorage.setItem(storageKey(), "open");
    } else {
      window.localStorage.removeItem(storageKey());
    }
  } catch {
    return;
  }
};
