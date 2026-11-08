export type SavedEdit = {
  readonly contents: string | null;
  readonly base: string | null;
};

export type SavedWorkspace = {
  readonly slug: string;
  readonly revision: number;
  readonly edits: Readonly<Record<string, SavedEdit>>;
  readonly updatedAt: number;
};

export type SavedView = {
  readonly slug: string;
  readonly output: string;
  readonly lastOutputAt: number;
  readonly selectedPath?: string;
};

export type SaveResult =
  | { kind: "saved"; revision: number }
  | { kind: "conflict"; revision: number };

export type WorkspaceStore = {
  load(slug: string): Promise<{ workspace?: SavedWorkspace; view?: SavedView }>;
  saveEdits(
    slug: string,
    edits: SavedWorkspace["edits"],
    expectedRevision: number,
  ): Promise<SaveResult>;
  saveView(view: SavedView): Promise<void>;
  subscribe(slug: string, listener: (revision: number) => void): () => void;
};

const databaseName = "fp-with-ts-code-explorer";
const channelName = "fp-with-ts-code-explorer";
const workspaceStoreName = "workspaces";
const viewStoreName = "views";

type RevisionMessage = Readonly<{ slug: string; revision: number }>;

const isRevisionMessage = (value: unknown): value is RevisionMessage =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RevisionMessage).slug === "string" &&
  typeof (value as RevisionMessage).revision === "number";

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("transaction aborted"));
  });

export const createIndexedDbWorkspaceStore = (): WorkspaceStore => {
  let connection: Promise<IDBDatabase> | undefined;
  let channel: BroadcastChannel | undefined;

  const connect = (): Promise<IDBDatabase> => {
    if (connection !== undefined) return connection;
    const next = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore(workspaceStoreName, { keyPath: "slug" });
        database.createObjectStore(viewStoreName, { keyPath: "slug" });
      };
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          if (connection === next) connection = undefined;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("IndexedDB の接続がほかのタブにふさがれています。"));
    });
    connection = next;
    next.catch(() => {
      if (connection === next) connection = undefined;
    });
    return next;
  };

  const getChannel = (): BroadcastChannel | undefined => {
    if (typeof BroadcastChannel === "undefined") return undefined;
    channel ??= new BroadcastChannel(channelName);
    return channel;
  };

  return {
    load: async (slug) => {
      const database = await connect();
      const transaction = database.transaction(
        [workspaceStoreName, viewStoreName],
        "readonly",
      );
      const workspaceRequest = requestResult<SavedWorkspace | undefined>(
        transaction.objectStore(workspaceStoreName).get(slug),
      );
      const viewRequest = requestResult<SavedView | undefined>(
        transaction.objectStore(viewStoreName).get(slug),
      );
      const [workspace, view] = await Promise.all([
        workspaceRequest,
        viewRequest,
        transactionDone(transaction),
      ]);
      return {
        ...(workspace === undefined ? {} : { workspace }),
        ...(view === undefined ? {} : { view }),
      };
    },

    saveEdits: async (slug, edits, expectedRevision) => {
      const database = await connect();
      const transaction = database.transaction(workspaceStoreName, "readwrite");
      const objectStore = transaction.objectStore(workspaceStoreName);
      const done = transactionDone(transaction);
      const result = new Promise<SaveResult>((resolve, reject) => {
        const request = objectStore.get(slug);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const current = request.result as SavedWorkspace | undefined;
          const currentRevision = current?.revision ?? 0;
          if (currentRevision !== expectedRevision) {
            resolve({ kind: "conflict", revision: currentRevision });
            return;
          }
          const revision = currentRevision + 1;
          const next: SavedWorkspace = {
            slug,
            revision,
            edits,
            updatedAt: Date.now(),
          };
          objectStore.put(next);
          resolve({ kind: "saved", revision });
        };
      });
      const [saveResult] = await Promise.all([result, done]);
      if (saveResult.kind === "saved") {
        getChannel()?.postMessage({
          slug,
          revision: saveResult.revision,
        } satisfies RevisionMessage);
      }
      return saveResult;
    },

    saveView: async (view) => {
      const database = await connect();
      const transaction = database.transaction(viewStoreName, "readwrite");
      transaction.objectStore(viewStoreName).put(view);
      await transactionDone(transaction);
    },

    subscribe: (slug, listener) => {
      const subscribed = getChannel();
      if (subscribed === undefined) return () => undefined;
      const handleMessage = (event: MessageEvent<unknown>) => {
        if (isRevisionMessage(event.data) && event.data.slug === slug) {
          listener(event.data.revision);
        }
      };
      subscribed.addEventListener("message", handleMessage);
      return () => subscribed.removeEventListener("message", handleMessage);
    },
  };
};
