export type ReceptionPollingEnvironment = Readonly<{
  setInterval: (callback: () => void, milliseconds: number) => unknown;
  clearInterval: (handle: unknown) => void;
  isVisible: () => boolean;
  subscribeVisibility: (listener: () => void) => () => void;
  isBusy: () => boolean;
  reload: (onFinish: () => void) => void;
}>;

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
