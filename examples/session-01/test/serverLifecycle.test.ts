import { EventEmitter } from "node:events";

import { expect, test } from "vitest";

import { createEnvironmentOwnedApp } from "../src/serverLifecycle.js";

class CloseableResource {
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

  invalidate = (): void => {
    this.disposer?.({});
  };
}

const asProcess = (events: EventEmitter): Pick<NodeJS.Process, "once"> =>
  ({ once: events.once.bind(events) }) as Pick<NodeJS.Process, "once">;

test("production ownerはprocess exitだけでappを一度閉じる", () => {
  const exitEvents = new EventEmitter();
  const hot = new HotLifecycle();
  const app = new CloseableResource();
  const options = {
    createApp: () => app,
    environment: `${import.meta.url}:production`,
    hot,
    isProduction: true,
    process: asProcess(exitEvents),
  };

  createEnvironmentOwnedApp(options);

  expect(exitEvents.listenerCount("exit")).toBe(1);
  expect(hot.disposer).toBeUndefined();

  exitEvents.emit("exit", 0);
  exitEvents.emit("exit", 0);

  expect(app.closeCount).toBe(1);
});

test("development ownerはHMR disposalで所有appだけを一度閉じる", () => {
  const exitEvents = new EventEmitter();
  const hot = new HotLifecycle();
  const app = new CloseableResource();
  const environment = `${import.meta.url}:development`;
  const options = {
    createApp: () => app,
    environment,
    hot,
    isProduction: false,
    process: asProcess(exitEvents),
  };

  createEnvironmentOwnedApp(options);

  expect(exitEvents.listenerCount("exit")).toBe(0);
  expect(hot.disposer).toBeTypeOf("function");

  const firstDisposer = hot.disposer;
  const replacementHot = new HotLifecycle();
  const replacement = new CloseableResource();
  createEnvironmentOwnedApp({
    createApp: () => replacement,
    environment,
    hot: replacementHot,
    isProduction: false,
    process: asProcess(exitEvents),
  });

  firstDisposer?.({});
  firstDisposer?.({});

  expect(app.closeCount).toBe(1);
  expect(replacement.closeCount).toBe(0);

  const replacementDisposer = replacementHot.disposer;
  const currentHot = new HotLifecycle();
  const current = new CloseableResource();
  createEnvironmentOwnedApp({
    createApp: () => current,
    environment,
    hot: currentHot,
    isProduction: false,
    process: asProcess(exitEvents),
  });

  expect(replacement.closeCount).toBe(1);
  expect(current.closeCount).toBe(0);

  replacementDisposer?.({});
  replacementDisposer?.({});
  currentHot.invalidate();
  currentHot.invalidate();

  expect(replacement.closeCount).toBe(1);
  expect(current.closeCount).toBe(1);
});
