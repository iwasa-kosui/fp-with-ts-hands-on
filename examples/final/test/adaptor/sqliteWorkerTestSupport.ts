import type { Worker } from "node:worker_threads";

const errorFrom = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

export const waitForWorkerMessage = (
  worker: Worker,
  expectedMessage: string,
  timeoutMilliseconds: number,
): Promise<void> => new Promise((resolve, reject) => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;

  const cleanup = (): void => {
    clearTimeout(timer);
    worker.off("message", onMessage);
    worker.off("messageerror", onMessageError);
    worker.off("error", onError);
    worker.off("exit", onExit);
  };
  const settle = (result: Readonly<{ kind: "Resolved" }> | Readonly<{
    kind: "Rejected";
    error: Error;
  }>): void => {
    if (settled) return;
    settled = true;
    cleanup();
    if (result.kind === "Resolved") {
      resolve();
      return;
    }
    reject(result.error);
  };
  const onMessage = (message: unknown): void => {
    if (message !== expectedMessage) return;
    settle({ kind: "Resolved" });
  };
  const onMessageError = (cause: unknown): void => {
    settle({ kind: "Rejected", error: errorFrom(cause) });
  };
  const onError = (cause: Error): void => {
    settle({ kind: "Rejected", error: cause });
  };
  const onExit = (code: number): void => {
    settle({
      kind: "Rejected",
      error: new Error(`Worker exited before message ${expectedMessage} (code ${code})`),
    });
  };

  worker.on("message", onMessage);
  worker.on("messageerror", onMessageError);
  worker.on("error", onError);
  worker.on("exit", onExit);
  timer = setTimeout(() => {
    settle({
      kind: "Rejected",
      error: new Error(
        `Timed out waiting ${timeoutMilliseconds}ms for worker message: ${expectedMessage}`,
      ),
    });
  }, timeoutMilliseconds);
});

export type WorkerExitOutcome =
  | Readonly<{ kind: "Exited"; code: number }>
  | Readonly<{ kind: "Failed"; error: Error }>
  | Readonly<{ kind: "TimedOut"; timeoutMilliseconds: number }>;

export const observeWorkerExit = (
  worker: Worker,
  timeoutMilliseconds: number,
): Promise<WorkerExitOutcome> => new Promise((resolve) => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout>;

  const cleanup = (): void => {
    clearTimeout(timer);
    worker.off("messageerror", onMessageError);
    worker.off("error", onError);
    worker.off("exit", onExit);
  };
  const settle = (outcome: WorkerExitOutcome): void => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(outcome);
  };
  const onMessageError = (cause: unknown): void => {
    settle({ kind: "Failed", error: errorFrom(cause) });
  };
  const onError = (cause: Error): void => {
    settle({ kind: "Failed", error: cause });
  };
  const onExit = (code: number): void => {
    settle({ kind: "Exited", code });
  };

  worker.on("messageerror", onMessageError);
  worker.on("error", onError);
  worker.on("exit", onExit);
  timer = setTimeout(() => {
    settle({ kind: "TimedOut", timeoutMilliseconds });
  }, timeoutMilliseconds);
});

export const terminateWorker = (
  worker: Worker,
  timeoutMilliseconds: number,
): Promise<void> => new Promise((resolve, reject) => {
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    reject(new Error(`Timed out terminating worker after ${timeoutMilliseconds}ms`));
  }, timeoutMilliseconds);
  const settle = (error?: Error): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error === undefined) {
      resolve();
      return;
    }
    reject(error);
  };

  worker.terminate().then(
    () => settle(),
    (cause: unknown) => settle(errorFrom(cause)),
  );
});

export const shutdownWorker = async (
  worker: Worker,
  release: () => void,
  observedExit: Promise<WorkerExitOutcome>,
  terminateTimeoutMilliseconds: number,
): Promise<WorkerExitOutcome> => {
  release();
  const outcome = await observedExit;
  if (outcome.kind === "Exited" && outcome.code === 0) return outcome;
  await terminateWorker(worker, terminateTimeoutMilliseconds);
  return outcome;
};
