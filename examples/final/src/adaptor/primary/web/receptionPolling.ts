export type ReceptionPollingEnvironment = Readonly<{
  setInterval: (callback: () => void, milliseconds: number) => unknown;
  clearInterval: (handle: unknown) => void;
  isVisible: () => boolean;
  subscribeVisibility: (listener: () => void) => () => void;
  isBusy: () => boolean;
  reload: (onFinish: () => void) => void;
}>;

export type BrowserReceptionPollingDependencies = Readonly<{
  document: Readonly<{
    addEventListener: (type: "visibilitychange", listener: () => void) => void;
    removeEventListener: (type: "visibilitychange", listener: () => void) => void;
    visibilityState: DocumentVisibilityState;
  }>;
  isBusy: () => boolean;
  reload: (options: Readonly<{
    onFinish: () => void;
    only: string[];
  }>) => void;
  window: Readonly<{
    clearInterval: (handle: number) => void;
    setInterval: (callback: () => void, milliseconds: number) => number;
  }>;
}>;

export const createBrowserReceptionPollingEnvironment = (
  dependencies: BrowserReceptionPollingDependencies,
): ReceptionPollingEnvironment => ({
  setInterval: (callback, milliseconds) =>
    dependencies.window.setInterval(callback, milliseconds),
  clearInterval: (handle) => dependencies.window.clearInterval(Number(handle)),
  isVisible: () => dependencies.document.visibilityState === "visible",
  subscribeVisibility: (listener) => {
    dependencies.document.addEventListener("visibilitychange", listener);
    return () => dependencies.document.removeEventListener("visibilitychange", listener);
  },
  isBusy: dependencies.isBusy,
  reload: (onFinish) => dependencies.reload({ only: ["board"], onFinish }),
});

export const startReceptionPolling = (environment: ReceptionPollingEnvironment): (() => void) => {
  let reloading = false;
  let stopped = false;
  const reloadIfIdle = () => {
    if (stopped || reloading || !environment.isVisible() || environment.isBusy()) return;
    reloading = true;
    environment.reload(() => { reloading = false; });
  };
  const interval = environment.setInterval(reloadIfIdle, 30_000);
  const unsubscribe = environment.subscribeVisibility(() => {
    if (environment.isVisible()) reloadIfIdle();
  });
  return () => {
    stopped = true;
    environment.clearInterval(interval);
    unsubscribe();
  };
};
