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
  type WorkspaceChange,
} from "./runner";
import { chmodBinScript } from "./deps-snapshot-shared.mjs";

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

  it("does not load the snapshot when the request skips it", async () => {
    const runtime = createInMemoryRuntime();
    const loadDepsSnapshot = vi.fn(async () => snapshot);

    const session = await createTerminalRunner(async () => runtime, {
      loadDepsSnapshot,
    }).start(requestFor({ skipDepsSnapshot: true }));

    expect(loadDepsSnapshot).not.toHaveBeenCalled();
    expect(runtime.restoreDependencies).not.toHaveBeenCalled();
    expect(runtime.installCalls).toHaveBeenCalledOnce();
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

const createFinishedProcess = (
  output: string,
  exitCode: number,
): TerminalRuntimeProcess => ({
  input: new WritableStream<string>(),
  output: new ReadableStream<string>({
    start: (controller) => {
      controller.enqueue(output);
      controller.close();
    },
  }),
  exit: Promise.resolve(exitCode),
  kill: vi.fn(),
  resize: vi.fn(),
});

describe("terminal runner commands", () => {
  it("runs a command as its own process and returns its exit code", async () => {
    const outputs: string[] = [];
    const spawnCommand = vi.fn(async () =>
      createFinishedProcess("result\r\n", 1),
    );
    const runtime: TerminalRuntime = {
      ...createInMemoryRuntime(),
      spawnCommand,
    };
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor({ onOutput: (chunk) => outputs.push(chunk) }),
    );

    const exitCode = await session.runCommand?.(
      "node",
      ["vendor/exercise-guard/cli.mjs"],
      { cols: 80, rows: 24 },
    );

    expect(exitCode).toBe(1);
    expect(spawnCommand).toHaveBeenCalledWith(
      "node",
      ["vendor/exercise-guard/cli.mjs"],
      { cols: 80, rows: 24 },
    );
    expect(outputs.join("")).toContain("$ node vendor/exercise-guard/cli.mjs");
    expect(outputs.join("")).toContain("result\r\n");
    await session.dispose();
  });

  it("rejects a command when the runtime cannot spawn one", async () => {
    const session = await createTerminalRunner(async () =>
      createInMemoryRuntime(),
    ).start(requestFor());

    await expect(
      session.runCommand?.("node", [], { cols: 80, rows: 24 }),
    ).rejects.toThrow("この実行環境ではコマンドを実行できません。");
    await session.dispose();
  });

  it("kills a running command when the session is disposed", async () => {
    const commandProcess = createControlledProcess();
    const runtime: TerminalRuntime = {
      ...createInMemoryRuntime(),
      spawnCommand: async () => commandProcess,
    };
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(),
    );
    const running = session.runCommand?.("node", [], { cols: 80, rows: 24 });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await session.dispose();

    expect(commandProcess.kill).toHaveBeenCalledOnce();
    await expect(running).resolves.toBe(143);
  });

  it("reads a text file from the workspace", async () => {
    const runtime: TerminalRuntime = {
      ...createInMemoryRuntime(),
      readWorkspaceEntry: vi.fn(async () => ({
        kind: "file" as const,
        contents: new TextEncoder().encode('{"version":1}'),
      })),
    };
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(),
    );

    await expect(session.readFile?.("dist/guard/result.json")).resolves.toBe(
      '{"version":1}',
    );
    expect(runtime.readWorkspaceEntry).toHaveBeenCalledWith(
      "dist/guard/result.json",
    );
    await session.dispose();
  });

  it("returns nothing for a missing file or a directory", async () => {
    const readWorkspaceEntry = vi
      .fn<TerminalRuntime["readWorkspaceEntry"]>()
      .mockRejectedValueOnce(
        Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
      )
      .mockResolvedValueOnce({ kind: "directory", entries: [] });
    const runtime: TerminalRuntime = {
      ...createInMemoryRuntime(),
      readWorkspaceEntry,
    };
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(),
    );

    await expect(session.readFile?.("dist/missing.json")).resolves.toBeUndefined();
    await expect(session.readFile?.("dist")).resolves.toBeUndefined();
    await session.dispose();
  });

  it("rejects reading a path that escapes the project directory", async () => {
    const session = await createTerminalRunner(async () =>
      createInMemoryRuntime(),
    ).start(requestFor());

    await expect(session.readFile?.("../outside.json")).rejects.toThrow(
      "Unsupported workspace path: ../outside.json",
    );
    await session.dispose();
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
    const rm = vi.fn(async () => undefined);
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount,
      spawn,
      teardown,
      fs: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(),
        rm,
        readdir: async () => [],
        readFile: async () => "",
        watch: vi.fn(() => ({ close: vi.fn() })),
      },
    });
    return { spawn, mount, rm };
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

  it("removes the partly restored node_modules before installing", async () => {
    const { spawn, rm } = bootWithSpawn(1);

    const session = await createWebContainerTerminalRunner({
      loadDepsSnapshot: async () => new Uint8Array([1]),
    }).start(requestFor());

    expect(rm).toHaveBeenCalledWith("workspace/node_modules", {
      recursive: true,
      force: true,
    });
    expect(rm.mock.invocationCallOrder[0]).toBeLessThan(
      spawn.mock.invocationCallOrder[
        spawn.mock.calls.findIndex(([command]) => command === "npm")
      ]!,
    );
    await session.dispose();
  });

  it("ignores a broken symlink while restoring executable bits", () => {
    const run = new Function(
      "require",
      chmodBinScript,
    ) as (require: (name: string) => unknown) => void;
    const chmodSync = vi.fn((path: string) => {
      if (path.endsWith("broken")) throw new Error("ENOENT");
    });

    expect(() =>
      run(() => ({
        existsSync: () => true,
        readdirSync: () => ["broken", "tsc"],
        chmodSync,
      })),
    ).not.toThrow();
    expect(chmodSync).toHaveBeenCalledWith("node_modules/.bin/tsc", 0o755);
  });

  describe("runtime slot", () => {
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    const fakeContainer = (teardown: () => Promise<void> | void) => ({
      mount: vi.fn(async () => undefined),
      spawn: vi.fn(async () => ({
        input: new WritableStream<string>(),
        output: new ReadableStream<string>({
          start: (controller) => controller.close(),
        }),
        exit: Promise.resolve(0),
        kill: vi.fn(),
        resize: vi.fn(),
      })),
      teardown,
      fs: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(),
        readdir: async () => [],
        readFile: async () => "",
        watch: vi.fn(() => ({ close: vi.fn() })),
      },
    });

    const runner = () =>
      createWebContainerTerminalRunner({ loadDepsSnapshot: async () => null });

    it("does not boot the next runtime until the previous teardown finishes", async () => {
      const gate = Promise.withResolvers<void>();
      webContainerMock.boot.mockReset();
      webContainerMock.boot
        .mockResolvedValueOnce(fakeContainer(() => gate.promise))
        .mockResolvedValueOnce(fakeContainer(() => undefined));
      const first = await runner().start(requestFor());

      const disposing = first.dispose();
      const second = runner().start(requestFor());
      await flush();
      expect(webContainerMock.boot).toHaveBeenCalledTimes(1);

      gate.resolve();
      await disposing;
      const secondSession = await second;
      expect(webContainerMock.boot).toHaveBeenCalledTimes(2);
      await secondSession.dispose();
    });

    it("boots the next runtime after the previous boot fails", async () => {
      webContainerMock.boot.mockReset();
      webContainerMock.boot
        .mockRejectedValueOnce(new Error("boot failed"))
        .mockResolvedValueOnce(fakeContainer(() => undefined));

      const first = runner().start(requestFor());
      const second = runner().start(requestFor());

      await expect(first).rejects.toThrow("boot failed");
      const secondSession = await second;
      expect(webContainerMock.boot).toHaveBeenCalledTimes(2);
      await secondSession.dispose();
    });

    it("leaves no slot behind when a waiting start is aborted", async () => {
      webContainerMock.boot.mockReset();
      webContainerMock.boot
        .mockResolvedValueOnce(fakeContainer(() => undefined))
        .mockResolvedValueOnce(fakeContainer(() => undefined));
      const first = await runner().start(requestFor());
      const controller = new AbortController();
      const aborted = runner().start(requestFor({ signal: controller.signal }));
      const assertion = expect(aborted).rejects.toMatchObject({
        name: "AbortError",
      });
      await flush();

      controller.abort();
      await assertion;
      const third = runner().start(requestFor());
      await flush();
      expect(webContainerMock.boot).toHaveBeenCalledTimes(1);

      await first.dispose();
      const thirdSession = await third;
      expect(webContainerMock.boot).toHaveBeenCalledTimes(2);
      await thirdSession.dispose();
    });
  });
});

describe("terminal runner workspace synchronization", () => {
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  const startWithFileSystem = async () => {
    const fileSystem = new Map<string, string>([["src/main.ts", "edited main"]]);
    const writes: Array<{
      path: string;
      contents: string;
      finish: () => void;
      fail: (error: Error) => void;
    }> = [];
    const readGate: { current?: Promise<void> } = {};
    let emit: (path: string) => void = () => undefined;
    const changes: WorkspaceChange[] = [];
    const runtime: TerminalRuntime = {
      ...createInMemoryRuntime(),
      watchWorkspace: vi.fn((onPath) => {
        emit = onPath;
        return () => undefined;
      }),
      readWorkspaceEntry: vi.fn(async (path) => {
        const contents = fileSystem.get(path);
        if (contents === undefined) {
          throw Object.assign(new Error("ENOENT: no such file"), {
            code: "ENOENT",
          });
        }
        await readGate.current;
        return { kind: "file" as const, contents };
      }),
      writeWorkspaceFile: vi.fn(
        (path, contents) =>
          new Promise<void>((resolve, reject) => {
            writes.push({
              path,
              contents,
              finish: () => {
                fileSystem.set(path, contents);
                resolve();
              },
              fail: reject,
            });
          }),
      ),
    };
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor({ onWorkspaceChange: (change) => changes.push(change) }),
    );
    return {
      session,
      runtime,
      fileSystem,
      writes,
      changes,
      readGate,
      emit: (path: string) => emit(path),
    };
  };

  it("ignores events while a write to the path is pending", async () => {
    const { session, runtime, fileSystem, writes, changes, emit } =
      await startWithFileSystem();
    fileSystem.set("src/main.ts", "older contents");

    const writing = session.writeFile("src/main.ts", "typed");
    emit("src/main.ts");
    await settle();
    writes[0]?.finish();
    await writing;
    emit("src/main.ts");
    await settle();

    expect(runtime.readWorkspaceEntry).toHaveBeenCalledTimes(1);
    expect(changes).toEqual([]);
    await session.dispose();
  });

  it("drops contents read while a write started during the read", async () => {
    const { session, fileSystem, writes, changes, readGate, emit } =
      await startWithFileSystem();
    fileSystem.set("src/main.ts", "older contents");
    let releaseRead!: () => void;
    readGate.current = new Promise<void>((resolve) => {
      releaseRead = resolve;
    });

    emit("src/main.ts");
    await settle();
    const writing = session.writeFile("src/main.ts", "typed");
    releaseRead();
    await settle();
    writes[0]?.finish();
    await writing;
    await settle();

    expect(changes).toEqual([]);
    await session.dispose();
  });

  it("does not report the file again after its own write finished", async () => {
    const { session, writes, changes, emit } = await startWithFileSystem();

    const writing = session.writeFile("src/main.ts", "typed");
    await settle();
    writes[0]?.finish();
    await writing;
    emit("src/main.ts");
    await settle();

    expect(changes).toEqual([]);
    await session.dispose();
  });

  it("reports contents a command changed when no write is pending", async () => {
    const { session, fileSystem, changes, emit } = await startWithFileSystem();
    fileSystem.set("src/main.ts", "changed by a command");

    emit("src/main.ts");
    await settle();

    expect(changes).toEqual([
      { kind: "write", path: "src/main.ts", contents: "changed by a command" },
    ]);
    await session.dispose();
  });

  it("writes only the first and the last of writes queued behind one in progress", async () => {
    const { session, runtime, writes } = await startWithFileSystem();

    const first = session.writeFile("src/main.ts", "first");
    await settle();
    const queued = [
      session.writeFile("src/main.ts", "second"),
      session.writeFile("src/main.ts", "third"),
      session.writeFile("src/main.ts", "fourth"),
    ];
    expect(writes).toHaveLength(1);
    writes[0]?.finish();
    await settle();
    expect(writes).toHaveLength(2);
    writes[1]?.finish();
    await Promise.all([first, ...queued]);

    expect(vi.mocked(runtime.writeWorkspaceFile).mock.calls).toEqual([
      ["src/main.ts", "first"],
      ["src/main.ts", "fourth"],
    ]);
    await session.dispose();
  });

  it("keeps the order of writes to different paths", async () => {
    const { session, runtime, writes } = await startWithFileSystem();

    const results = [
      session.writeFile("src/a.ts", "a"),
      session.writeFile("src/b.ts", "b"),
    ];
    await settle();
    writes[0]?.finish();
    await settle();
    writes[1]?.finish();
    await Promise.all(results);

    expect(vi.mocked(runtime.writeWorkspaceFile).mock.calls).toEqual([
      ["src/a.ts", "a"],
      ["src/b.ts", "b"],
    ]);
    await session.dispose();
  });

  it("continues with the next write and leaves nothing pending after a failed write", async () => {
    const { session, fileSystem, writes, changes, emit } =
      await startWithFileSystem();

    const failing = session.writeFile("src/main.ts", "first");
    const failed = expect(failing).rejects.toThrow("disk full");
    await settle();
    const following = session.writeFile("src/main.ts", "second");
    writes[0]?.fail(new Error("disk full"));
    await failed;
    await settle();
    writes[1]?.finish();
    await following;
    fileSystem.set("src/main.ts", "changed by a command");
    emit("src/main.ts");
    await settle();

    expect(changes).toEqual([
      { kind: "write", path: "src/main.ts", contents: "changed by a command" },
    ]);
    await session.dispose();
  });
});
