// @vitest-environment node
import { gzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDepsSnapshotLoader,
  isCovered,
  type DepsSnapshotManifest,
} from "./deps-snapshot";

const payload = new TextEncoder().encode("node_modules ".repeat(200));
const gzipped = gzipSync(payload);
const firstPart = gzipped.subarray(0, 12);
const secondPart = gzipped.subarray(12);

const manifest: DepsSnapshotManifest = {
  hash: "0123456789abcdef",
  rawSize: payload.byteLength,
  gzipSize: gzipped.byteLength,
  parts: ["part-000.bin", "part-001.bin"],
  dependencies: { zod: "^3.25.0", vitest: "^2.1.0" },
};
const packageJson = JSON.stringify({
  dependencies: { zod: "^3.25.0" },
  devDependencies: { vitest: "^2.1.0" },
});
const partUrl = (name: string) => `/deps-snapshot/${manifest.hash}/${name}`;
const cacheName = `deps-snapshot-${manifest.hash}`;

type CacheBehavior = Readonly<{
  put?: (url: string) => Promise<void> | undefined;
  open?: (name: string) => Promise<void> | undefined;
  match?: (url: string, call: number) => Promise<unknown> | undefined;
}>;

const createCaches = (
  initialNames: readonly string[] = [],
  behavior: CacheBehavior = {},
) => {
  let matchCalls = 0;
  const stores = new Map<string, Map<string, ArrayBuffer>>(
    initialNames.map((name) => [name, new Map()]),
  );
  const caches = {
    open: async (name: string) => {
      await behavior.open?.(name);
      const store = stores.get(name) ?? new Map<string, ArrayBuffer>();
      stores.set(name, store);
      return {
        match: async (url: string) => {
          const overridden = behavior.match?.(url, ++matchCalls);
          if (overridden !== undefined) return overridden;
          const stored = store.get(url);
          return stored === undefined ? undefined : new Response(stored);
        },
        put: async (url: string, response: Response) => {
          await behavior.put?.(url);
          store.set(url, await response.arrayBuffer());
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  return { caches: caches as unknown as CacheStorage, stores };
};

const createFetch = (
  responses: Readonly<Record<string, () => Response>>,
): ReturnType<typeof vi.fn<typeof fetch>> =>
  vi.fn<typeof fetch>(async (input) => {
    const respond = responses[String(input)];
    return respond === undefined
      ? new Response("missing", { status: 404 })
      : respond();
  });

const healthyResponses = {
  "/deps-snapshot/manifest.json": () => Response.json(manifest),
  [partUrl("part-000.bin")]: () => new Response(firstPart),
  [partUrl("part-001.bin")]: () => new Response(secondPart),
};

const createLoader = (
  options: Readonly<{
    fetch: typeof fetch;
    caches?: CacheStorage;
  }>,
) => {
  const caches = options.caches ?? createCaches().caches;
  return createDepsSnapshotLoader(() => ({
    fetch: options.fetch,
    caches,
    DecompressionStream: globalThis.DecompressionStream,
    stallTimeoutMilliseconds: 20_000,
  }));
};

const requestFor = (
  overrides: Partial<Parameters<ReturnType<typeof createLoader>["load"]>[0]> = {},
) => ({
  packageJson,
  signal: new AbortController().signal,
  ...overrides,
});

describe("isCovered", () => {
  it("accepts dependencies that exist with the same range", () => {
    expect(isCovered(manifest, packageJson)).toBe(true);
  });

  it("rejects a dependency whose range differs or is missing", () => {
    expect(
      isCovered(
        manifest,
        JSON.stringify({ dependencies: { zod: "^3.0.0" } }),
      ),
    ).toBe(false);
    expect(
      isCovered(manifest, JSON.stringify({ devDependencies: { hono: "^4" } })),
    ).toBe(false);
  });
});

describe("deps snapshot loader", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the decompressed bytes and reports progress up to gzipSize", async () => {
    const onProgress = vi.fn();
    const fetchMock = createFetch(healthyResponses);

    const bytes = await createLoader({ fetch: fetchMock }).load(
      requestFor({ onProgress }),
    );

    expect(bytes).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "/deps-snapshot/manifest.json",
      expect.objectContaining({ cache: "no-cache" }),
    );
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: manifest.gzipSize,
      total: manifest.gzipSize,
    });
  });

  it("returns null when a dependency range does not match the manifest", async () => {
    const fetchMock = createFetch(healthyResponses);

    const bytes = await createLoader({ fetch: fetchMock }).load(
      requestFor({
        packageJson: JSON.stringify({ dependencies: { zod: "^3.0.0" } }),
      }),
    );

    expect(bytes).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch a part that is already cached", async () => {
    const { caches } = createCaches();
    const fetchMock = createFetch(healthyResponses);
    const onProgress = vi.fn();
    const loader = createLoader({ fetch: fetchMock, caches });
    await loader.load(requestFor());
    fetchMock.mockClear();

    const bytes = await loader.load(requestFor({ onProgress }));

    expect(bytes).toEqual(payload);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      "/deps-snapshot/manifest.json",
    ]);
    expect(onProgress).toHaveBeenLastCalledWith({
      loaded: manifest.gzipSize,
      total: manifest.gzipSize,
    });
  });

  it("deletes older snapshot caches after a successful download", async () => {
    const { caches, stores } = createCaches([
      "deps-snapshot-ffff",
      "unrelated-cache",
    ]);

    await createLoader({ fetch: createFetch(healthyResponses), caches }).load(
      requestFor(),
    );

    expect([...stores.keys()].sort()).toEqual([cacheName, "unrelated-cache"]);
  });

  it("shares one download between a prefetch and a load", async () => {
    const fetchMock = createFetch(healthyResponses);
    const loader = createLoader({ fetch: fetchMock });

    const prefetching = loader.prefetch();
    const bytes = await loader.load(requestFor());
    await prefetching;

    expect(bytes).toEqual(payload);
    const partFetches = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith(".bin"),
    );
    expect(partFetches).toHaveLength(2);
  });

  it("returns null when a part responds with 404", async () => {
    const fetchMock = createFetch({
      ...healthyResponses,
      [partUrl("part-001.bin")]: () => new Response("gone", { status: 404 }),
    });

    expect(await createLoader({ fetch: fetchMock }).load(requestFor())).toBeNull();
  });

  it("returns null when the manifest is missing or malformed", async () => {
    expect(
      await createLoader({ fetch: createFetch({}) }).load(requestFor()),
    ).toBeNull();
    expect(
      await createLoader({
        fetch: createFetch({
          "/deps-snapshot/manifest.json": () => new Response("not json"),
        }),
      }).load(requestFor()),
    ).toBeNull();
  });

  it("deletes the cache and returns null when the parts are not valid gzip", async () => {
    const { caches, stores } = createCaches();
    const fetchMock = createFetch({
      ...healthyResponses,
      [partUrl("part-000.bin")]: () => new Response(new Uint8Array(40).fill(7)),
      [partUrl("part-001.bin")]: () => new Response(new Uint8Array(40).fill(7)),
    });

    const bytes = await createLoader({ fetch: fetchMock, caches }).load(
      requestFor(),
    );

    expect(bytes).toBeNull();
    expect(stores.has(cacheName)).toBe(false);
  });

  it("fails when nothing is received for 20 seconds", async () => {
    vi.useFakeTimers();
    const fetchMock = createFetch({
      ...healthyResponses,
      [partUrl("part-000.bin")]: () =>
        new Response(new ReadableStream<Uint8Array>({ start: () => undefined })),
    });
    const loading = createLoader({ fetch: fetchMock }).load(requestFor());

    await vi.advanceTimersByTimeAsync(20_000);

    expect(await loading).toBeNull();
  });

  it("rejects with the abort reason when the signal aborts", async () => {
    const controller = new AbortController();
    const fetchMock = createFetch({
      ...healthyResponses,
      [partUrl("part-000.bin")]: () =>
        new Response(new ReadableStream<Uint8Array>({ start: () => undefined })),
    });
    const loading = createLoader({ fetch: fetchMock }).load(
      requestFor({ signal: controller.signal }),
    );
    const assertion = expect(loading).rejects.toMatchObject({
      name: "AbortError",
    });

    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        partUrl("part-000.bin"),
        expect.anything(),
      ),
    );
    controller.abort();

    await assertion;
  });

  it("returns null when Cache Storage or DecompressionStream is unavailable", async () => {
    const fetchMock = createFetch(healthyResponses);

    expect(
      await createDepsSnapshotLoader(() => ({
        fetch: fetchMock,
        caches: undefined,
        DecompressionStream: globalThis.DecompressionStream,
        stallTimeoutMilliseconds: 20_000,
      })).load(requestFor()),
    ).toBeNull();
    expect(
      await createDepsSnapshotLoader(() => ({
        fetch: fetchMock,
        caches: createCaches().caches,
        DecompressionStream: undefined,
        stallTimeoutMilliseconds: 20_000,
      })).load(requestFor()),
    ).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes older snapshot caches before it fetches the first part", async () => {
    const { caches, stores } = createCaches(["deps-snapshot-ffff"]);
    let cachesAtFirstPart: string[] = [];
    const fetchMock = createFetch({
      ...healthyResponses,
      [partUrl("part-000.bin")]: () => {
        cachesAtFirstPart = [...stores.keys()];
        return new Response(firstPart);
      },
    });

    await createLoader({ fetch: fetchMock, caches }).load(requestFor());

    expect(cachesAtFirstPart).not.toContain("deps-snapshot-ffff");
  });

  describe("when the cache cannot store a part", () => {
    const quotaExceeded = () => Promise.reject(new Error("QuotaExceededError"));

    it("deletes the cache and still returns the bytes from memory", async () => {
      const { caches, stores } = createCaches([], { put: quotaExceeded });
      const fetchMock = createFetch(healthyResponses);

      const bytes = await createLoader({ fetch: fetchMock, caches }).load(
        requestFor(),
      );

      expect(bytes).toEqual(payload);
      expect(stores.has(cacheName)).toBe(false);
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith(".bin")),
      ).toHaveLength(2);
    });

    it("keeps the parts stored before the failure when the second part fails", async () => {
      const { caches, stores } = createCaches([], {
        put: (url) =>
          url === partUrl("part-001.bin") ? quotaExceeded() : undefined,
      });
      const fetchMock = createFetch(healthyResponses);

      const bytes = await createLoader({ fetch: fetchMock, caches }).load(
        requestFor(),
      );

      expect(bytes).toEqual(payload);
      expect(stores.has(cacheName)).toBe(false);
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith(".bin")),
      ).toHaveLength(2);
    });

    it("drops the downloaded bytes after a prefetch", async () => {
      const { caches, stores } = createCaches([], { put: quotaExceeded });
      const fetchMock = createFetch(healthyResponses);
      const loader = createLoader({ fetch: fetchMock, caches });

      await loader.prefetch();
      expect(stores.has(cacheName)).toBe(false);
      await loader.load(requestFor());

      expect(
        fetchMock.mock.calls.filter(
          ([input]) => String(input) === partUrl("part-000.bin"),
        ),
      ).toHaveLength(2);
    });
  });

  describe("cache stalls", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const never = () => new Promise<never>(() => undefined);

    it("returns null when opening the cache never finishes", async () => {
      vi.useFakeTimers();
      const { caches } = createCaches([], { open: never });
      const loading = createLoader({
        fetch: createFetch(healthyResponses),
        caches,
      }).load(requestFor());

      await vi.advanceTimersByTimeAsync(20_000);

      expect(await loading).toBeNull();
    });

    it("returns null when reading a cached part never finishes", async () => {
      vi.useFakeTimers();
      const { caches } = createCaches([], {
        match: (_url, call) => (call === 1 ? never() : undefined),
      });
      const loading = createLoader({
        fetch: createFetch(healthyResponses),
        caches,
      }).load(requestFor());

      await vi.advanceTimersByTimeAsync(20_000);

      expect(await loading).toBeNull();
    });

    it("returns null when a cached part never yields its size", async () => {
      vi.useFakeTimers();
      const { caches } = createCaches([], {
        match: () => Promise.resolve({ blob: never }),
      });
      const loading = createLoader({
        fetch: createFetch(healthyResponses),
        caches,
      }).load(requestFor());

      await vi.advanceTimersByTimeAsync(20_000);

      expect(await loading).toBeNull();
    });

    it("returns null when decompression starves for 20 seconds", async () => {
      vi.useFakeTimers();
      const { caches } = createCaches([], {
        match: (_url, call) => (call > 2 ? never() : undefined),
      });
      const loading = createLoader({
        fetch: createFetch(healthyResponses),
        caches,
      }).load(requestFor());

      await vi.advanceTimersByTimeAsync(20_000);

      expect(await loading).toBeNull();
    });
  });
});
