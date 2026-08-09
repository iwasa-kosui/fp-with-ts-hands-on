import { expect, test } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

import {
  observeWorkerExit,
  shutdownWorker,
  terminateWorker,
  waitForWorkerMessage,
} from "./sqliteWorkerTestSupport.js";

const terminateProbeWorker = async (worker: Worker): Promise<void> => {
  await terminateWorker(worker, 500);
};

const expectNoWaitListeners = (worker: Worker): void => {
  expect(worker.listenerCount("message")).toBe(0);
  expect(worker.listenerCount("messageerror")).toBe(0);
  expect(worker.listenerCount("error")).toBe(0);
  expect(worker.listenerCount("exit")).toBe(0);
};

test("worker message wait rejects within its own timeout and removes every listener", async () => {
  const worker = new Worker("setInterval(() => undefined, 1000)", { eval: true });
  const startedAt = performance.now();
  try {
    await expect(waitForWorkerMessage(worker, "ready", 50)).rejects.toThrow(
      "Timed out waiting 50ms for worker message: ready",
    );
    expect(performance.now() - startedAt).toBeLessThan(500);
    expectNoWaitListeners(worker);
  } finally {
    await terminateProbeWorker(worker);
  }
});

test("worker message wait rejects a normal exit before the expected message", async () => {
  const worker = new Worker("void 0", { eval: true });
  try {
    await expect(waitForWorkerMessage(worker, "ready", 500)).rejects.toThrow(
      "Worker exited before message ready (code 0)",
    );
    expectNoWaitListeners(worker);
  } finally {
    await terminateProbeWorker(worker);
  }
});

test("worker message wait forwards worker errors and removes every listener", async () => {
  const worker = new Worker("throw new Error('probe worker failure')", { eval: true });
  try {
    await expect(waitForWorkerMessage(worker, "ready", 500)).rejects.toThrow(
      "probe worker failure",
    );
    expectNoWaitListeners(worker);
  } finally {
    await terminateProbeWorker(worker);
  }
});

test("worker message wait rejects deserialization errors and removes every listener", async () => {
  const worker = new Worker("setInterval(() => undefined, 1000)", { eval: true });
  const waiting = waitForWorkerMessage(worker, "ready", 500);
  worker.emit("messageerror", new Error("probe message decode failure"));
  try {
    await expect(waiting).rejects.toThrow("probe message decode failure");
    expectNoWaitListeners(worker);
  } finally {
    await terminateProbeWorker(worker);
  }
});

test("worker shutdown releases a blocked worker and observes its normal exit", async () => {
  const releaseBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const releaseSignal = new Int32Array(releaseBuffer);
  const worker = new Worker(
    "const { workerData } = require('node:worker_threads'); Atomics.wait(new Int32Array(workerData), 0, 0)",
    { eval: true, workerData: releaseBuffer },
  );
  const exit = observeWorkerExit(worker, 500);

  const outcome = await shutdownWorker(worker, () => {
    Atomics.store(releaseSignal, 0, 1);
    Atomics.notify(releaseSignal, 0);
  }, exit, 500);

  expect(outcome).toEqual({ kind: "Exited", code: 0 });
  expect(Atomics.load(releaseSignal, 0)).toBe(1);
  expectNoWaitListeners(worker);
});

test("worker shutdown terminates a worker that exceeds the bounded exit wait", async () => {
  const worker = new Worker("setInterval(() => undefined, 1000)", { eval: true });
  const exit = observeWorkerExit(worker, 50);
  const startedAt = performance.now();

  const outcome = await shutdownWorker(worker, () => undefined, exit, 500);

  expect(outcome).toEqual({ kind: "TimedOut", timeoutMilliseconds: 50 });
  expect(performance.now() - startedAt).toBeLessThan(500);
  expectNoWaitListeners(worker);
});

test("a timed-out SQLite lock holder is released, closed, and removed", async () => {
  const directory = mkdtempSync(join(tmpdir(), "clinic-worker-timeout-"));
  const databasePath = join(directory, "probe.sqlite");
  const releaseBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const releaseSignal = new Int32Array(releaseBuffer);
  const worker = new Worker(String.raw`
    const Database = require("better-sqlite3");
    const { parentPort, workerData } = require("node:worker_threads");
    const database = new Database(workerData.databasePath);
    try {
      database.exec("BEGIN IMMEDIATE");
      parentPort.postMessage("locked");
      Atomics.wait(new Int32Array(workerData.releaseBuffer), 0, 0);
      database.exec("ROLLBACK");
    } finally {
      try {
        if (database.inTransaction) database.exec("ROLLBACK");
      } finally {
        database.close();
      }
    }
  `, {
    eval: true,
    workerData: { databasePath, releaseBuffer },
  });
  const exit = observeWorkerExit(worker, 500);
  try {
    await waitForWorkerMessage(worker, "locked", 500);
    await expect(waitForWorkerMessage(worker, "missing", 50)).rejects.toThrow(
      "Timed out waiting 50ms for worker message: missing",
    );
  } finally {
    try {
      await shutdownWorker(worker, () => {
        Atomics.store(releaseSignal, 0, 1);
        Atomics.notify(releaseSignal, 0);
      }, exit, 500);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
  expect(existsSync(directory)).toBe(false);
  expectNoWaitListeners(worker);
});
