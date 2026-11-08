export type DepsSnapshotManifest = Readonly<{
  hash: string;
  rawSize: number;
  gzipSize: number;
  parts: readonly string[];
  dependencies: Readonly<Record<string, string>>;
}>;

export type DepsSnapshotProgress = Readonly<{ loaded: number; total: number }>;

export type DepsSnapshotRequest = Readonly<{
  packageJson: string;
  signal: AbortSignal;
  onProgress?: (progress: DepsSnapshotProgress) => void;
}>;

export type DepsSnapshotEnvironment = Readonly<{
  fetch: typeof fetch;
  caches: CacheStorage | undefined;
  DecompressionStream: typeof DecompressionStream | undefined;
  stallTimeoutMilliseconds: number;
}>;

export type DepsSnapshotLoader = Readonly<{
  prefetch: () => Promise<void>;
  load: (request: DepsSnapshotRequest) => Promise<Uint8Array | null>;
}>;

const snapshotDirectory = "/deps-snapshot";
const manifestUrl = `${snapshotDirectory}/manifest.json`;
const cacheNamePrefix = "deps-snapshot-";
const stallTimeoutMilliseconds = 20_000;

class DepsSnapshotStallError extends Error {
  constructor() {
    super("Dependency snapshot download stalled");
    this.name = "DepsSnapshotStallError";
  }
}

const defaultEnvironment = (): DepsSnapshotEnvironment => ({
  fetch: (input, init) => globalThis.fetch(input, init),
  caches: globalThis.caches,
  DecompressionStream: globalThis.DecompressionStream,
  stallTimeoutMilliseconds,
});

const isRecordOfStrings = (
  value: unknown,
): value is Readonly<Record<string, string>> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((entry) => typeof entry === "string");

const parseManifest = (value: unknown): DepsSnapshotManifest | null => {
  if (typeof value !== "object" || value === null) return null;
  const { hash, rawSize, gzipSize, parts, dependencies } = value as Record<
    string,
    unknown
  >;
  if (
    typeof hash !== "string" ||
    !/^[0-9a-f]+$/.test(hash) ||
    typeof rawSize !== "number" ||
    typeof gzipSize !== "number" ||
    !Array.isArray(parts) ||
    parts.length === 0 ||
    !parts.every(
      (part): part is string =>
        typeof part === "string" && /^part-\d+\.bin$/.test(part),
    ) ||
    !isRecordOfStrings(dependencies)
  ) {
    return null;
  }
  return { hash, rawSize, gzipSize, parts, dependencies };
};

export const isCovered = (
  manifest: DepsSnapshotManifest,
  packageJsonText: string,
): boolean => {
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(packageJsonText);
  } catch {
    return false;
  }
  if (typeof packageJson !== "object" || packageJson === null) return false;
  const { dependencies, devDependencies } = packageJson as Record<
    string,
    unknown
  >;
  for (const group of [dependencies, devDependencies]) {
    if (group === undefined) continue;
    if (!isRecordOfStrings(group)) return false;
    for (const [name, range] of Object.entries(group)) {
      if (
        !Object.hasOwn(manifest.dependencies, name) ||
        manifest.dependencies[name] !== range
      ) {
        return false;
      }
    }
  }
  return true;
};

const abortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("Aborted", "AbortError");

const raceAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) return Promise.reject(abortReason(signal));
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(abortReason(signal));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  return Promise.race([promise, aborted]).finally(() => {
    if (onAbort !== undefined) signal.removeEventListener("abort", onAbort);
  });
};

type PartOutcome =
  | Readonly<{ kind: "cached" }>
  | Readonly<{ kind: "stored" }>
  | Readonly<{ kind: "memory"; bytes: Uint8Array<ArrayBuffer> }>;

type MemoryParts = ReadonlyMap<string, Uint8Array<ArrayBuffer>>;

type Acquired = Readonly<{
  manifest: DepsSnapshotManifest;
  memory: MemoryParts | undefined;
}>;

type PartDownload = {
  loaded: number;
  readonly listeners: Set<(delta: number) => void>;
  readonly promise: Promise<PartOutcome>;
};

export const createDepsSnapshotLoader = (
  getEnvironment: () => DepsSnapshotEnvironment = defaultEnvironment,
): DepsSnapshotLoader => {
  const downloads = new Map<string, PartDownload>();
  let manifestInFlight: Promise<DepsSnapshotManifest | null> | undefined;

  const withStallGuard = async <T>(
    stallMilliseconds: number,
    run: (
      signal: AbortSignal,
      guard: <U>(promise: Promise<U>) => Promise<U>,
      touch: () => void,
    ) => Promise<T>,
  ): Promise<T> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const touch = () => {
      clearTimeout(timer);
      timer = setTimeout(
        () => controller.abort(new DepsSnapshotStallError()),
        stallMilliseconds,
      );
    };
    const stalled = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(controller.signal.reason),
        { once: true },
      );
    });
    stalled.catch(() => undefined);
    touch();
    try {
      return await run(
        controller.signal,
        (promise) => Promise.race([promise, stalled]),
        touch,
      );
    } finally {
      clearTimeout(timer);
    }
  };

  const fetchManifest = (): Promise<DepsSnapshotManifest | null> => {
    manifestInFlight ??= (async () => {
      const environment = getEnvironment();
      try {
        return await withStallGuard(
          environment.stallTimeoutMilliseconds,
          async (signal, guard) => {
            const response = await guard(
              environment.fetch(manifestUrl, { cache: "no-cache", signal }),
            );
            if (!response.ok) return null;
            return parseManifest(await guard(response.json()));
          },
        );
      } catch {
        return null;
      }
    })().finally(() => {
      manifestInFlight = undefined;
    });
    return manifestInFlight;
  };

  const cacheStep = <T>(
    environment: DepsSnapshotEnvironment,
    run: () => Promise<T>,
  ): Promise<T> =>
    withStallGuard(environment.stallTimeoutMilliseconds, (_signal, guard) =>
      guard(run()),
    );

  const concatenate = (
    chunks: readonly Uint8Array[],
  ): Uint8Array<ArrayBuffer> => {
    const bytes = new Uint8Array(
      chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  };

  const downloadPart = async (
    environment: DepsSnapshotEnvironment,
    cache: Cache | undefined,
    url: string,
    report: (delta: number) => void,
  ): Promise<PartOutcome> => {
    if (cache !== undefined) {
      const cached = await cacheStep(environment, () => cache.match(url));
      if (cached !== undefined) {
        report((await cacheStep(environment, () => cached.blob())).size);
        return { kind: "cached" };
      }
    }
    return withStallGuard(
      environment.stallTimeoutMilliseconds,
      async (signal, guard, touch) => {
        const response = await guard(environment.fetch(url, { signal }));
        if (!response.ok || response.body === null) {
          throw new Error(`Failed to download ${url}: ${response.status}`);
        }
        touch();
        let source = response.body;
        let putting: Promise<void> | undefined;
        if (cache !== undefined) {
          const [forProgress, forCache] = response.body.tee();
          source = forProgress;
          putting = cache.put(
            url,
            new Response(forCache, {
              headers: { "Content-Type": "application/octet-stream" },
            }),
          );
          putting.catch(() => undefined);
        }
        const chunks: Uint8Array[] = [];
        const reader = source.getReader();
        try {
          for (;;) {
            const { done, value } = await guard(reader.read());
            if (done) break;
            touch();
            chunks.push(value);
            report(value.byteLength);
          }
        } catch (error: unknown) {
          void reader.cancel().catch(() => undefined);
          throw error;
        }
        if (putting !== undefined) {
          try {
            await guard(putting);
            return { kind: "stored" };
          } catch (error: unknown) {
            if (signal.aborted) throw error;
          }
        }
        return { kind: "memory", bytes: concatenate(chunks) };
      },
    );
  };

  const ensurePart = (
    environment: DepsSnapshotEnvironment,
    cache: Cache | undefined,
    url: string,
    listener: (delta: number) => void,
  ): Promise<PartOutcome> => {
    let download = downloads.get(url);
    if (download === undefined) {
      const listeners = new Set<(delta: number) => void>();
      const created: PartDownload = {
        loaded: 0,
        listeners,
        promise: downloadPart(environment, cache, url, (delta) => {
          created.loaded += delta;
          for (const notify of listeners) notify(delta);
        }).finally(() => {
          downloads.delete(url);
        }),
      };
      downloads.set(url, created);
      download = created;
    }
    const joined = download;
    if (joined.loaded > 0) listener(joined.loaded);
    joined.listeners.add(listener);
    return joined.promise.finally(() => {
      joined.listeners.delete(listener);
    });
  };

  const deleteStaleCaches = async (
    environment: DepsSnapshotEnvironment,
    currentName: string,
  ): Promise<void> => {
    const names = await cacheStep(environment, () => environment.caches!.keys());
    await Promise.all(
      names
        .filter((name) => name.startsWith(cacheNamePrefix) && name !== currentName)
        .map((name) =>
          cacheStep(environment, () => environment.caches!.delete(name)),
        ),
    );
  };

  const ensureParts = async (
    environment: DepsSnapshotEnvironment,
    manifest: DepsSnapshotManifest,
    onProgress: ((progress: DepsSnapshotProgress) => void) | undefined,
    retainInMemory: boolean,
  ): Promise<MemoryParts | undefined> => {
    const cacheName = `${cacheNamePrefix}${manifest.hash}`;
    await deleteStaleCaches(environment, cacheName).catch(() => undefined);
    const cache = await cacheStep(environment, () =>
      environment.caches!.open(cacheName),
    );
    let loaded = 0;
    const listener = (delta: number) => {
      loaded += delta;
      onProgress?.({ loaded, total: manifest.gzipSize });
    };
    const urls = manifest.parts.map(
      (part) => `${snapshotDirectory}/${manifest.hash}/${part}`,
    );
    const memory = new Map<string, Uint8Array<ArrayBuffer>>();
    let activeCache: Cache | undefined = cache;
    for (const [index, url] of urls.entries()) {
      const outcome = await ensurePart(environment, activeCache, url, listener);
      if (outcome.kind !== "memory") continue;
      if (activeCache !== undefined) {
        activeCache = undefined;
        if (retainInMemory) {
          for (const earlier of urls.slice(0, index)) {
            const stored = await cacheStep(environment, () =>
              cache.match(earlier),
            );
            if (stored === undefined) {
              throw new Error(`Missing cached part: ${earlier}`);
            }
            memory.set(
              earlier,
              new Uint8Array(
                await cacheStep(environment, () => stored.arrayBuffer()),
              ),
            );
          }
        }
        await cacheStep(environment, () =>
          environment.caches!.delete(cacheName),
        ).catch(() => false);
      }
      if (!retainInMemory) return undefined;
      memory.set(url, outcome.bytes);
    }
    return memory.size > 0 ? memory : undefined;
  };

  const decompress = async (
    environment: DepsSnapshotEnvironment,
    manifest: DepsSnapshotManifest,
    memory: MemoryParts | undefined,
    signal: AbortSignal,
  ): Promise<Uint8Array> =>
    withStallGuard(
      environment.stallTimeoutMilliseconds,
      async (_stallSignal, guard, touch) => {
        const cache =
          memory === undefined
            ? await guard(
                environment.caches!.open(`${cacheNamePrefix}${manifest.hash}`),
              )
            : undefined;
        const stream = new environment.DecompressionStream!("gzip");
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        const feeding = (async () => {
          try {
            for (const part of manifest.parts) {
              const url = `${snapshotDirectory}/${manifest.hash}/${part}`;
              const bytes = memory?.get(url);
              if (bytes !== undefined) {
                if (signal.aborted) throw abortReason(signal);
                await guard(writer.write(bytes));
                touch();
                continue;
              }
              const response = await guard(cache!.match(url));
              if (response === undefined || response.body === null) {
                throw new Error(`Missing cached part: ${part}`);
              }
              const partReader = response.body.getReader();
              for (;;) {
                if (signal.aborted) throw abortReason(signal);
                const { done, value } = await guard(partReader.read());
                if (done) break;
                touch();
                await guard(writer.write(value));
              }
            }
            await guard(writer.close());
          } catch (error: unknown) {
            await writer.abort(error).catch(() => undefined);
            throw error;
          }
        })();

        const collecting = (async () => {
          const chunks: Uint8Array[] = [];
          for (;;) {
            const { done, value } = await guard(reader.read());
            if (done) break;
            touch();
            chunks.push(value);
          }
          return concatenate(chunks);
        })();

        const [fed, collected] = await Promise.allSettled([feeding, collecting]);
        if (fed.status === "rejected") throw fed.reason;
        if (collected.status === "rejected") throw collected.reason;
        return collected.value;
      },
    );

  const isSupported = (environment: DepsSnapshotEnvironment): boolean =>
    environment.caches !== undefined &&
    environment.DecompressionStream !== undefined;

  const prefetch = async (): Promise<void> => {
    const environment = getEnvironment();
    if (!isSupported(environment)) return;
    try {
      const manifest = await fetchManifest();
      if (manifest === null) return;
      await ensureParts(environment, manifest, undefined, false);
    } catch {
      return;
    }
  };

  const acquire = async (
    environment: DepsSnapshotEnvironment,
    { packageJson, signal, onProgress }: DepsSnapshotRequest,
  ): Promise<Acquired | null> => {
    try {
      const manifest = await raceAbort(fetchManifest(), signal);
      if (manifest === null || !isCovered(manifest, packageJson)) return null;
      const memory = await raceAbort(
        ensureParts(environment, manifest, onProgress, true),
        signal,
      );
      return { manifest, memory };
    } catch {
      if (signal.aborted) throw abortReason(signal);
      return null;
    }
  };

  const load = async (
    request: DepsSnapshotRequest,
  ): Promise<Uint8Array | null> => {
    const environment = getEnvironment();
    if (!isSupported(environment)) return null;
    const acquired = await acquire(environment, request);
    if (acquired === null) return null;
    const { manifest, memory } = acquired;
    try {
      return await decompress(environment, manifest, memory, request.signal);
    } catch (error: unknown) {
      if (request.signal.aborted) throw abortReason(request.signal);
      if (memory === undefined && !(error instanceof DepsSnapshotStallError)) {
        await environment
          .caches!.delete(`${cacheNamePrefix}${manifest.hash}`)
          .catch(() => false);
      }
      return null;
    }
  };

  return { prefetch, load };
};

const defaultLoader = createDepsSnapshotLoader();

export const prefetchDepsSnapshot = (): Promise<void> =>
  defaultLoader.prefetch();

export const loadDepsSnapshot = (
  request: DepsSnapshotRequest,
): Promise<Uint8Array | null> => defaultLoader.load(request);
