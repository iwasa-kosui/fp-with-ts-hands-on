import { describe, expect, test, vi } from "vitest";

import { startReceptionPolling, type ReceptionPollingEnvironment } from "../../src/adaptor/primary/web/receptionPolling.js";

const harness = () => {
  let interval: (() => void) | undefined;
  let visibilityListener: (() => void) | undefined;
  let visible = true;
  let busy = false;
  let finish: (() => void) | undefined;
  const reload = vi.fn((onFinish: () => void) => { finish = onFinish; });
  const environment: ReceptionPollingEnvironment = {
    setInterval: (callback) => { interval = callback; return 1; },
    clearInterval: vi.fn(),
    isVisible: () => visible,
    subscribeVisibility: (listener) => { visibilityListener = listener; return () => { visibilityListener = undefined; }; },
    isBusy: () => busy,
    reload,
  };
  return {
    environment, reload,
    tick: () => interval?.(),
    finish: () => { const callback = finish; finish = undefined; callback?.(); },
    setVisible: (value: boolean) => { visible = value; visibilityListener?.(); },
    setBusy: (value: boolean) => { busy = value; },
  };
};

describe("startReceptionPolling", () => {
  test("reloads every 30 seconds only while visible and idle, then reloads immediately on visibility recovery", () => {
    const fake = harness();
    const stop = startReceptionPolling(fake.environment);

    fake.tick();
    expect(fake.reload).toHaveBeenCalledTimes(1);
    fake.finish();
    fake.setVisible(false);
    fake.tick();
    fake.tick();
    expect(fake.reload).toHaveBeenCalledTimes(1);
    fake.setVisible(true);
    expect(fake.reload).toHaveBeenCalledTimes(2);
    fake.finish();
    fake.setBusy(true);
    fake.tick();
    expect(fake.reload).toHaveBeenCalledTimes(2);
    stop();
    expect(fake.environment.clearInterval).toHaveBeenCalledWith(1);
  });

  test("does not overlap an unfinished reload", () => {
    const fake = harness();
    startReceptionPolling(fake.environment);
    fake.tick();
    fake.tick();
    expect(fake.reload).toHaveBeenCalledTimes(1);
    fake.finish();
    fake.tick();
    expect(fake.reload).toHaveBeenCalledTimes(2);
  });
});
