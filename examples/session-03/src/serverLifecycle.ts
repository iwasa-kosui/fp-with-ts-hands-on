type CloseableApp = Readonly<{ close: () => void }>;
type AppOwner = Readonly<{ close: () => void }>;

type EnvironmentOwnedAppOptions<App extends CloseableApp> = Readonly<{
  createApp: () => App;
  environment: string;
  hot: Pick<NonNullable<ImportMeta["hot"]>, "dispose"> | undefined;
  isProduction: boolean;
  process: Pick<NodeJS.Process, "once">;
}>;

const appOwnersKey = Symbol.for("@fp-with-ts/session-03/app-owners");
const runtime = globalThis as typeof globalThis & {
  [appOwnersKey]?: Map<string, AppOwner>;
};
const appOwners = runtime[appOwnersKey] ?? new Map<string, AppOwner>();
runtime[appOwnersKey] = appOwners;

const closeOwnedApp = (environment: string, owner?: AppOwner): void => {
  const ownedApp = owner ?? appOwners.get(environment);
  if (ownedApp === undefined) return;

  ownedApp.close();
  if (appOwners.get(environment) === ownedApp) appOwners.delete(environment);
};

export const closeEnvironmentOwnedApp = (environment: string): void => {
  closeOwnedApp(environment);
};

const own = (app: CloseableApp): AppOwner => {
  let closed = false;
  return {
    close: () => {
      if (closed) return;
      closed = true;
      app.close();
    },
  };
};

export const createEnvironmentOwnedApp = <App extends CloseableApp>({
  createApp,
  environment,
  hot,
  isProduction,
  process,
}: EnvironmentOwnedAppOptions<App>): App => {
  if (!isProduction) closeEnvironmentOwnedApp(environment);

  const app = createApp();
  const owner = own(app);

  if (isProduction) {
    process.once("exit", owner.close);
  } else {
    appOwners.set(environment, owner);
    hot?.dispose(() => closeOwnedApp(environment, owner));
  }

  return app;
};
