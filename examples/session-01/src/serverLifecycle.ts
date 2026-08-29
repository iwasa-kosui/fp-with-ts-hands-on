type HttpServer = Readonly<{
  close: (callback: (error?: Error) => void) => unknown;
}>;

type ShutdownOptions = Readonly<{
  server: HttpServer;
  closeDatabase: () => void;
  onComplete?: (error?: Error) => void;
}>;

export const createShutdown = ({
  server,
  closeDatabase,
  onComplete = () => undefined,
}: ShutdownOptions): (() => void) => {
  let started = false;
  let completed = false;

  const complete = (error?: Error): void => {
    if (completed) {
      return;
    }

    completed = true;
    try {
      closeDatabase();
    } finally {
      onComplete(error);
    }
  };

  return () => {
    if (started) {
      return;
    }

    started = true;
    try {
      server.close(complete);
    } catch (error) {
      complete(error instanceof Error ? error : new Error(String(error)));
    }
  };
};
