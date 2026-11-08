import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTerminalRunner,
  createWebContainerTerminalRunner,
  TerminalInstallError,
  TerminalPreparationTimeoutError,
  type TerminalPhase,
  type TerminalRuntime,
  type TerminalRuntimeProcess,
  type TerminalStartRequest,
} from "./runner";

const webContainerMock = vi.hoisted(() => ({
  boot: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@webcontainer/api", () => ({
  WebContainer: { boot: webContainerMock.boot },
}));

type ControlledProcess = TerminalRuntimeProcess &
  Readonly<{
    finish: (exitCode: number) => void;
  }>;

const createControlledProcess = (): ControlledProcess => {
  let outputController!: ReadableStreamDefaultController<string>;
  let resolveExit!: (exitCode: number) => void;
  let finished = false;
  const exit = new Promise<number>((resolve) => {
    resolveExit = resolve;
  });
  const finish = (exitCode: number) => {
    if (finished) return;
    finished = true;
    outputController.close();
    resolveExit(exitCode);
  };

  return {
    input: new WritableStream<string>(),
    output: new ReadableStream<string>({
      start: (controller) => {
        outputController = controller;
      },
    }),
    exit,
    kill: vi.fn(() => finish(143)),
    resize: vi.fn(),
    finish,
  };
};

type InMemoryRuntime = TerminalRuntime &
  Readonly<{
    processes: ControlledProcess[];
    stopWatching: ReturnType<typeof vi.fn>;
    installCalls: ReturnType<typeof vi.fn>;
  }>;

const createInMemoryRuntime = (
  options: Readonly<{
    installExitCode?: number;
    install?: (signal: AbortSignal) => Promise<number>;
  }> = {},
): InMemoryRuntime => {
  const processes: ControlledProcess[] = [];
  const stopWatching = vi.fn();
  const installCalls = vi.fn();

  return {
    processes,
    stopWatching,
    installCalls,
    mount: vi.fn(async () => undefined),
    restoreDependencies: vi.fn(async () => undefined),
    install: async (signal) => {
      installCalls();
      if (options.install !== undefined) return options.install(signal);
      return options.installExitCode ?? 0;
    },
    readTypeFiles: vi.fn(async () => ({})),
    watchWorkspace: vi.fn(() => stopWatching),
    readWorkspaceEntry: vi.fn(),
    writeWorkspaceFile: vi.fn(async () => undefined),
    spawnShell: async () => {
      const process = createControlledProcess();
      processes.push(process);
      return process;
    },
    dispose: vi.fn(),
  };
};

const requestFor = (
  overrides: Partial<TerminalStartRequest> = {},
): TerminalStartRequest => ({
  files: {
    "src/main.ts": "edited main",
    "package.json": "{}",
  },
  visibleFiles: ["src/main.ts"],
  size: { cols: 80, rows: 24 },
  signal: new AbortController().signal,
  onPhase: () => undefined,
  onOutput: () => undefined,
  onTypeFiles: () => undefined,
  onWorkspaceChange: () => undefined,
  onExit: () => undefined,
  ...overrides,
});

describe("terminal runner", () => {
  it("releases its watcher, shell, and runtime when a session is disposed", async () => {
    const runtime = createInMemoryRuntime();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(),
    );

    await session.dispose();

    expect(runtime.stopWatching).toHaveBeenCalledOnce();
    expect(runtime.processes[0]?.kill).toHaveBeenCalledOnce();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("rejects workspace writes that escape the project directory", async () => {
    const runtime = createInMemoryRuntime();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(),
    );

    await expect(session.writeFile("../outside.ts", "blocked")).rejects.toThrow(
      "Unsupported workspace path: ../outside.ts",
    );

    await session.dispose();
  });

  it("aborts an installation in progress and disposes its runtime", async () => {
    let installationStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      installationStarted = resolve;
    });
    const runtime = createInMemoryRuntime({
      install: async (signal) => {
        installationStarted();
        return new Promise<number>((resolve) => {
          signal.addEventListener("abort", () => resolve(143), { once: true });
        });
      },
    });
    const controller = new AbortController();
    const starting = createTerminalRunner(async () => runtime).start(
      requestFor({ signal: controller.signal }),
    );
    await started;

    controller.abort();

    await expect(starting).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.processes).toHaveLength(0);
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the runtime after a failed install", async () => {
    const runtime = createInMemoryRuntime({ installExitCode: 1 });

    await expect(
      createTerminalRunner(async () => runtime).start(requestFor()),
    ).rejects.toThrow("Dependency installation failed with exit code 1");

    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("reports a failed install as a TerminalInstallError", async () => {
    const runtime = createInMemoryRuntime({ installExitCode: 1 });

    await expect(
      createTerminalRunner(async () => runtime).start(requestFor()),
    ).rejects.toBeInstanceOf(TerminalInstallError);
  });
});

describe("terminal runner dependency snapshot", () => {
  const snapshot = new Uint8Array([1, 2, 3]);

  const startWith = async (
    runtime: TerminalRuntime,
    loadDepsSnapshot: () => Promise<Uint8Array | null>,
  ) => {
    const phases: TerminalPhase[] = [];
    const session = await createTerminalRunner(async () => runtime, {
      loadDepsSnapshot,
    }).start(requestFor({ onPhase: (phase) => phases.push(phase) }));
    return { phases, session };
  };

  it("restores the snapshot without running an install", async () => {
    const runtime = createInMemoryRuntime();

    const { phases, session } = await startWith(runtime, async () => snapshot);

    expect(runtime.restoreDependencies).toHaveBeenCalledWith(snapshot);
    expect(runtime.installCalls).not.toHaveBeenCalled();
    expect(phases).toContain("restoring-deps");
    expect(phases).not.toContain("installing");
    await session.dispose();
  });

  it("runs an install when no snapshot is available", async () => {
    const runtime = createInMemoryRuntime();

    const { phases, session } = await startWith(runtime, async () => null);

    expect(runtime.restoreDependencies).not.toHaveBeenCalled();
    expect(runtime.installCalls).toHaveBeenCalledOnce();
    expect(phases).toContain("installing");
    await session.dispose();
  });

  it("falls back to an install when restoring fails", async () => {
    const runtime = createInMemoryRuntime();
    vi.mocked(runtime.restoreDependencies).mockRejectedValueOnce(
      new Error("chmod failed"),
    );

    const { phases, session } = await startWith(runtime, async () => snapshot);

    expect(phases).toEqual(
      expect.arrayContaining(["restoring-deps", "installing"]),
    );
    expect(runtime.installCalls).toHaveBeenCalledOnce();
    await session.dispose();
  });

  it("reports download progress and waits for the download after mounting", async () => {
    const runtime = createInMemoryRuntime();
    const progress = vi.fn();
    const phases: TerminalPhase[] = [];
    const session = await createTerminalRunner(async () => runtime, {
      loadDepsSnapshot: async ({ onProgress }) => {
        onProgress?.({ loaded: 1, total: 2 });
        return null;
      },
    }).start(
      requestFor({
        onPhase: (phase) => phases.push(phase),
        onDownloadProgress: progress,
      }),
    );

    expect(progress).toHaveBeenCalledWith({ loaded: 1, total: 2 });
    expect(phases.slice(0, 2)).toEqual(["booting", "mounting"]);
    await session.dispose();
  });
});

describe("terminal runner time limits", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws a timeout error naming the phase and disposes the runtime", async () => {
    vi.useFakeTimers();
    const runtime = createInMemoryRuntime({
      install: () => new Promise<number>(() => undefined),
    });
    const starting = createTerminalRunner(async () => runtime, {
      loadDepsSnapshot: async () => null,
    }).start(requestFor());
    const assertion = expect(starting).rejects.toMatchObject({
      name: "TerminalPreparationTimeoutError",
      phase: "installing",
    });

    await vi.advanceTimersByTimeAsync(240_000);
    await assertion;

    await expect(starting).rejects.toBeInstanceOf(
      TerminalPreparationTimeoutError,
    );
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });
});

describe("WebContainer terminal adapter", () => {
  it("rejects parent paths outside fixtures and tears down the runtime", async () => {
    const teardown = vi.fn();
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: vi.fn(),
      spawn: vi.fn(),
      teardown,
      fs: {
        mkdir: vi.fn(),
        writeFile: vi.fn(),
        readdir: async () => [],
        readFile: async () => "",
        watch: vi.fn(() => ({ close: vi.fn() })),
      },
    });

    await expect(
      createWebContainerTerminalRunner().start(
        requestFor({
          files: { "src/main.ts": "main", "../private.txt": "escape" },
        }),
      ),
    ).rejects.toThrow("Unsupported external project path: ../private.txt");

    expect(teardown).toHaveBeenCalledOnce();
  });

  const bootWithSpawn = (nodeExitCode: number) => {
    const spawn = vi.fn(async (_command: string) => ({
      input: new WritableStream<string>(),
      output: new ReadableStream<string>({
        start: (controller) => controller.close(),
      }),
      exit: Promise.resolve(_command === "node" ? nodeExitCode : 0),
      kill: vi.fn(),
      resize: vi.fn(),
    }));
    const mount = vi.fn(async () => undefined);
    const teardown = vi.fn();
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount,
      spawn,
      teardown,
      fs: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(),
        readdir: async () => [],
        readFile: async () => "",
        watch: vi.fn(() => ({ close: vi.fn() })),
      },
    });
    return { spawn, mount };
  };

  it("mounts the snapshot and restores executable bits instead of installing", async () => {
    const { spawn, mount } = bootWithSpawn(0);
    const snapshot = new Uint8Array([1, 2, 3]);

    const session = await createWebContainerTerminalRunner({
      loadDepsSnapshot: async () => snapshot,
    }).start(requestFor());

    expect(mount).toHaveBeenCalledWith(snapshot, {
      mountPoint: "workspace/node_modules",
    });
    expect(spawn).toHaveBeenCalledWith(
      "node",
      ["-e", expect.stringContaining("chmodSync")],
      { cwd: "workspace" },
    );
    expect(spawn.mock.calls.map(([command]) => command)).not.toContain("npm");
    await session.dispose();
  });

  it("installs when restoring executable bits fails", async () => {
    const { spawn } = bootWithSpawn(1);

    const session = await createWebContainerTerminalRunner({
      loadDepsSnapshot: async () => new Uint8Array([1]),
    }).start(requestFor());

    expect(spawn.mock.calls.map(([command]) => command)).toContain("npm");
    await session.dispose();
  });
});
