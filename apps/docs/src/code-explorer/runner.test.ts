import { describe, expect, it, vi } from "vitest";
import {
  createTerminalRunner,
  createWebContainerTerminalRunner,
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
  }>;

const createInMemoryRuntime = (
  options: Readonly<{
    installExitCode?: number;
    install?: (signal: AbortSignal) => Promise<number>;
  }> = {},
): InMemoryRuntime => {
  const processes: ControlledProcess[] = [];
  const stopWatching = vi.fn();

  return {
    processes,
    stopWatching,
    mount: vi.fn(async () => undefined),
    install: async (signal) => {
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
});
