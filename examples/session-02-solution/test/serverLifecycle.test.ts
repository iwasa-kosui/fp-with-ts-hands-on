import { EventEmitter } from "node:events";

import { expect, test } from "vitest";

import { createEnvironmentOwnedApp } from "../src/serverLifecycle.js";

class CloseableApp {
  closeCount = 0;

  close = (): void => {
    this.closeCount += 1;
  };
}

class HotLifecycle {
  disposer: ((data: unknown) => void) | undefined;

  dispose = (callback: (data: unknown) => void): void => {
    this.disposer = callback;
  };
}

const asProcess = (events: EventEmitter): Pick<NodeJS.Process, "once"> =>
  ({ once: events.once.bind(events) }) as Pick<NodeJS.Process, "once">;

test("Session 02 closes a production SQLite owner exactly once", () => {
  const exits = new EventEmitter();
  const app = new CloseableApp();
  createEnvironmentOwnedApp({
    createApp: () => app,
    environment: `${import.meta.url}:production`,
    hot: new HotLifecycle(),
    isProduction: true,
    process: asProcess(exits),
  });

  exits.emit("exit", 0);
  exits.emit("exit", 0);

  expect(app.closeCount).toBe(1);
});

test("Session 02 closes a replaced development SQLite owner without closing its replacement", () => {
  const exits = new EventEmitter();
  const environment = `${import.meta.url}:development`;
  const first = new CloseableApp();
  const firstHot = new HotLifecycle();
  createEnvironmentOwnedApp({
    createApp: () => first,
    environment,
    hot: firstHot,
    isProduction: false,
    process: asProcess(exits),
  });

  const replacement = new CloseableApp();
  createEnvironmentOwnedApp({
    createApp: () => replacement,
    environment,
    hot: new HotLifecycle(),
    isProduction: false,
    process: asProcess(exits),
  });
  firstHot.disposer?.({});

  expect(first.closeCount).toBe(1);
  expect(replacement.closeCount).toBe(0);
});
