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

type PartDownload = {
  loaded: number;
  readonly listeners: Set<(delta: number) => void>;
  readonly promise: Promise<void>;
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

  const downloadPart = async (
    environment: DepsSnapshotEnvironment,
    cache: Cache,
    url: string,
    report: (delta: number) => void,
  ): Promise<void> => {
    const cached = await cache.match(url);
    if (cached !== undefined) {
      report((await cached.blob()).size);
      return;
    }
    await withStallGuard(
      environment.stallTimeoutMilliseconds,
      async (signal, guard, touch) => {
        const response = await guard(environment.fetch(url, { signal }));
        if (!response.ok || response.body === null) {
          throw new Error(`Failed to download ${url}: ${response.status}`);
        }
        touch();
        const [forProgress, forCache] = response.body.tee();
        const putting = cache.put(
          url,
          new Response(forCache, {
            headers: { "Content-Type": "application/octet-stream" },
          }),
        );
        putting.catch(() => undefined);
        const reader = forProgress.getReader();
        try {
          for (;;) {
            const { done, value } = await guard(reader.read());
            if (done) break;
            touch();
            report(value.byteLength);
          }
        } catch (error: unknown) {
          void reader.cancel().catch(() => undefined);
          throw error;
        }
        await guard(putting);
      },
    );
  };

  const ensurePart = (
    environment: DepsSnapshotEnvironment,
    cache: Cache,
    url: string,
    listener: (delta: number) => void,
  ): Promise<void> => {
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
    const names = await environment.caches!.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(cacheNamePrefix) && name !== currentName)
        .map((name) => environment.caches!.delete(name)),
    );
  };

  const ensureParts = async (
    environment: DepsSnapshotEnvironment,
    manifest: DepsSnapshotManifest,
    onProgress: ((progress: DepsSnapshotProgress) => void) | undefined,
  ): Promise<void> => {
    const cacheName = `${cacheNamePrefix}${manifest.hash}`;
    const cache = await environment.caches!.open(cacheName);
    let loaded = 0;
    const listener = (delta: number) => {
      loaded += delta;
      onProgress?.({ loaded, total: manifest.gzipSize });
    };
    for (const part of manifest.parts) {
      await ensurePart(
        environment,
        cache,
        `${snapshotDirectory}/${manifest.hash}/${part}`,
        listener,
      );
    }
    await deleteStaleCaches(environment, cacheName).catch(() => undefined);
  };

  const decompress = async (
    environment: DepsSnapshotEnvironment,
    manifest: DepsSnapshotManifest,
    signal: AbortSignal,
  ): Promise<Uint8Array> => {
    const cache = await environment.caches!.open(
      `${cacheNamePrefix}${manifest.hash}`,
    );
    const stream = new environment.DecompressionStream!("gzip");
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    const feeding = (async () => {
      try {
        for (const part of manifest.parts) {
          const response = await cache.match(
            `${snapshotDirectory}/${manifest.hash}/${part}`,
          );
          if (response === undefined || response.body === null) {
            throw new Error(`Missing cached part: ${part}`);
          }
          const partReader = response.body.getReader();
          for (;;) {
            if (signal.aborted) throw abortReason(signal);
            const { done, value } = await partReader.read();
            if (done) break;
            await writer.write(value);
          }
        }
        await writer.close();
      } catch (error: unknown) {
        await writer.abort(error).catch(() => undefined);
        throw error;
      }
    })();

    const collecting = (async () => {
      const chunks: Uint8Array[] = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        length += value.byteLength;
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return bytes;
    })();

    const [fed, collected] = await Promise.allSettled([feeding, collecting]);
    if (fed.status === "rejected") throw fed.reason;
    if (collected.status === "rejected") throw collected.reason;
    return collected.value;
  };

  const isSupported = (environment: DepsSnapshotEnvironment): boolean =>
    environment.caches !== undefined &&
    environment.DecompressionStream !== undefined;

  const prefetch = async (): Promise<void> => {
    const environment = getEnvironment();
    if (!isSupported(environment)) return;
    try {
      const manifest = await fetchManifest();
      if (manifest === null) return;
      await ensureParts(environment, manifest, undefined);
    } catch {
      return;
    }
  };

  const acquire = async (
    environment: DepsSnapshotEnvironment,
    { packageJson, signal, onProgress }: DepsSnapshotRequest,
  ): Promise<DepsSnapshotManifest | null> => {
    try {
      const manifest = await raceAbort(fetchManifest(), signal);
      if (manifest === null || !isCovered(manifest, packageJson)) return null;
      await raceAbort(ensureParts(environment, manifest, onProgress), signal);
      return manifest;
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
    const manifest = await acquire(environment, request);
    if (manifest === null) return null;
    try {
      return await decompress(environment, manifest, request.signal);
    } catch {
      if (request.signal.aborted) throw abortReason(request.signal);
      await environment
        .caches!.delete(`${cacheNamePrefix}${manifest.hash}`)
        .catch(() => false);
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
