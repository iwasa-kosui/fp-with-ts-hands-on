import { describe, expect, it, vi } from "vitest";
import {
  buildFileSystemTree,
  createTerminalRunner,
  createWebContainerTerminalRunner,
  type TerminalPhase,
  type TerminalRuntime,
  type TerminalRuntimeProcess,
  type TerminalStartRequest,
  type WorkspaceChange,
} from "./runner";

const webContainerMock = vi.hoisted(() => ({
  boot: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@webcontainer/api", () => ({
  WebContainer: { boot: webContainerMock.boot },
}));

type ControlledProcess = TerminalRuntimeProcess &
  Readonly<{
    inputs: readonly string[];
    emit: (chunk: string) => void;
    finish: (exitCode: number) => void;
  }>;

const createControlledProcess = (): ControlledProcess => {
  const inputs: string[] = [];
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
    inputs,
    input: new WritableStream<string>({
      write: (chunk) => {
        inputs.push(chunk);
      },
    }),
    output: new ReadableStream<string>({
      start: (controller) => {
        outputController = controller;
      },
    }),
    exit,
    kill: vi.fn(() => finish(143)),
    resize: vi.fn(),
    emit: (chunk) => outputController.enqueue(chunk),
    finish,
  };
};

type InMemoryRuntime = TerminalRuntime &
  Readonly<{
    mounted: Record<string, string>;
    workspaceFiles: Map<string, string | Uint8Array>;
    processes: ControlledProcess[];
    emitPath: (path: string) => void;
    installCount: () => number;
    stopWatching: ReturnType<typeof vi.fn>;
  }>;

const createInMemoryRuntime = (
  options: Readonly<{ installExitCode?: number }> = {},
): InMemoryRuntime => {
  const mounted: Record<string, string> = {};
  const workspaceFiles = new Map<string, string | Uint8Array>();
  const processes: ControlledProcess[] = [];
  const stopWatching = vi.fn();
  let watcher: ((path: string) => void) | undefined;
  let installs = 0;

  return {
    mounted,
    workspaceFiles,
    processes,
    stopWatching,
    installCount: () => installs,
    emitPath: (path) => watcher?.(path),
    mount: async (files) => {
      Object.assign(mounted, files);
      for (const [path, contents] of Object.entries(files)) {
        if (!path.startsWith("../")) workspaceFiles.set(path, contents);
      }
    },
    install: async () => {
      installs += 1;
      return options.installExitCode ?? 0;
    },
    readTypeFiles: async () => ({
      "file:///node_modules/vitest/index.d.ts": "vitest types",
    }),
    watchWorkspace: (onPath) => {
      watcher = onPath;
      return stopWatching;
    },
    readWorkspaceFile: async (path) => {
      const contents = workspaceFiles.get(path);
      if (contents !== undefined) return contents;
      throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
    },
    writeWorkspaceFile: async (path, contents) => {
      workspaceFiles.set(path, contents);
    },
    spawnShell: async () => {
      const process = createControlledProcess();
      processes.push(process);
      return process;
    },
    dispose: vi.fn(),
  };
};

type Updates = Readonly<{
  phases: TerminalPhase[];
  output: string[];
  typeFiles: Record<string, string>[];
  changes: WorkspaceChange[];
  exits: number[];
}>;

const createUpdates = (): Updates => ({
  phases: [],
  output: [],
  typeFiles: [],
  changes: [],
  exits: [],
});

const requestFor = (
  updates: Updates,
  overrides: Partial<TerminalStartRequest> = {},
): TerminalStartRequest => ({
  files: {
    "src/main.ts": "edited main",
    "package.json": "{}",
  },
  visibleFiles: ["src/main.ts"],
  size: { cols: 80, rows: 24 },
  onPhase: (phase) => updates.phases.push(phase),
  onOutput: (chunk) => updates.output.push(chunk),
  onTypeFiles: (files) => updates.typeFiles.push({ ...files }),
  onWorkspaceChange: (change) => updates.changes.push(change),
  onExit: (exitCode) => updates.exits.push(exitCode),
  ...overrides,
});

const nextTask = async () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("terminal runner", () => {
  it("builds a nested WebContainer filesystem tree from flat paths", () => {
    expect(
      buildFileSystemTree({
        "src/clinic/appointment.ts": "appointment",
        "src/main.ts": "main",
        "package.json": "{}",
      }),
    ).toEqual({
      src: {
        directory: {
          clinic: {
            directory: {
              "appointment.ts": { file: { contents: "appointment" } },
            },
          },
          "main.ts": { file: { contents: "main" } },
        },
      },
      "package.json": { file: { contents: "{}" } },
    });
  });

  it("rejects empty path segments and file-directory collisions", () => {
    expect(() => buildFileSystemTree({ "src//main.ts": "" })).toThrow(
      /empty path segment/i,
    );
    expect(() =>
      buildFileSystemTree({ src: "file", "src/main.ts": "nested" }),
    ).toThrow(/collision/i);
    expect(() =>
      buildFileSystemTree({ "src/main.ts": "nested", src: "file" }),
    ).toThrow(/collision/i);
  });

  it("starts one persistent shell and forwards raw terminal I/O and resize", async () => {
    const runtime = createInMemoryRuntime();
    const updates = createUpdates();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(updates),
    );

    expect(updates.phases).toEqual([
      "booting",
      "mounting",
      "installing",
      "collecting-types",
      "starting-shell",
    ]);
    expect(runtime.mounted["src/main.ts"]).toBe("edited main");
    expect(updates.typeFiles).toEqual([
      { "file:///node_modules/vitest/index.d.ts": "vitest types" },
    ]);
    expect(runtime.processes).toHaveLength(1);

    runtime.processes[0]!.emit("\x1b[31mfailed\x1b[0m\r\n");
    await session.writeInput("pnpm test\r");
    session.resize({ cols: 120, rows: 40 });
    await nextTask();

    expect(updates.output).toEqual(["\x1b[31mfailed\x1b[0m\r\n"]);
    expect(runtime.processes[0]!.inputs).toEqual(["pnpm test\r"]);
    expect(runtime.processes[0]!.resize).toHaveBeenCalledWith({
      cols: 120,
      rows: 40,
    });

    runtime.processes[0]!.finish(0);
    await nextTask();
    expect(updates.exits).toEqual([0]);

    await session.restartShell({ cols: 100, rows: 30 });
    expect(runtime.processes).toHaveLength(2);
    await session.writeInput("pwd\r");
    expect(runtime.processes[1]!.inputs).toEqual(["pwd\r"]);

    await session.dispose();
    expect(runtime.stopWatching).toHaveBeenCalledOnce();
    expect(runtime.processes[1]!.kill).toHaveBeenCalledOnce();
    expect(runtime.dispose).toHaveBeenCalledOnce();
  });

  it("writes editor changes into the shared workspace", async () => {
    const runtime = createInMemoryRuntime();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(createUpdates()),
    );

    await session.writeFile("src/main.ts", "saved from editor");

    expect(runtime.workspaceFiles.get("src/main.ts")).toBe(
      "saved from editor",
    );
    await session.dispose();
  });

  it("projects visible edits, new UTF-8 files, and deletions", async () => {
    const runtime = createInMemoryRuntime();
    const updates = createUpdates();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(updates),
    );

    runtime.workspaceFiles.set("src/main.ts", "changed in terminal");
    runtime.emitPath("src/main.ts");
    runtime.workspaceFiles.set("src/created.ts", "export const created = true;\n");
    runtime.emitPath("src/created.ts");
    await nextTask();

    runtime.emitPath("src/created.ts");
    await nextTask();
    runtime.workspaceFiles.delete("src/created.ts");
    runtime.emitPath("src/created.ts");
    await nextTask();

    expect(updates.changes).toEqual([
      { kind: "write", path: "src/main.ts", contents: "changed in terminal" },
      {
        kind: "write",
        path: "src/created.ts",
        contents: "export const created = true;\n",
      },
      { kind: "delete", path: "src/created.ts" },
    ]);
    await session.dispose();
  });

  it("does not project hidden, generated, cached, or binary files", async () => {
    const runtime = createInMemoryRuntime();
    const updates = createUpdates();
    const session = await createTerminalRunner(async () => runtime).start(
      requestFor(updates),
    );
    const ignoredFiles: Readonly<Record<string, string | Uint8Array>> = {
      "package.json": "changed but initially hidden",
      "package-lock.json": "{}",
      "node_modules/zod/index.js": "module",
      ".cache/result.json": "cache",
      ".vite/result.json": "cache",
      ".astro/result.json": "cache",
      "dist/index.js": "build",
      "coverage/index.html": "coverage",
      "src/invalid.txt": new Uint8Array([0xff]),
      "src/binary.txt": "before\0after",
    };

    for (const [path, contents] of Object.entries(ignoredFiles)) {
      runtime.workspaceFiles.set(path, contents);
      runtime.emitPath(path);
    }
    await nextTask();

    expect(updates.changes).toEqual([]);
    await session.dispose();
  });

  it("disposes a failed install and can start again with a new runtime", async () => {
    const failedRuntime = createInMemoryRuntime({ installExitCode: 1 });
    const recoveredRuntime = createInMemoryRuntime();
    const runtimes = [failedRuntime, recoveredRuntime];
    const runner = createTerminalRunner(async () => runtimes.shift()!);

    await expect(runner.start(requestFor(createUpdates()))).rejects.toThrow(
      "Dependency installation failed with exit code 1",
    );
    expect(failedRuntime.dispose).toHaveBeenCalledOnce();

    const recovered = await runner.start(requestFor(createUpdates()));
    expect(recoveredRuntime.processes).toHaveLength(1);
    await recovered.dispose();
  });
});

describe("WebContainer terminal adapter", () => {
  it("decodes byte filenames emitted by the WebContainer watcher", async () => {
    let watchListener:
      | ((event: "rename" | "change", filename: string | Uint8Array) => void)
      | undefined;
    const shell = createControlledProcess();
    const install = createControlledProcess();
    install.finish(0);
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: vi.fn(),
      spawn: vi.fn(async (command: string) =>
        command === "npm" ? install : shell,
      ),
      teardown: vi.fn(),
      fs: {
        mkdir: vi.fn(async () => undefined),
        writeFile: vi.fn(async () => undefined),
        readdir: async () => [],
        readFile: async (path: string) => {
          if (path === "workspace/src/created.ts") return "created";
          throw Object.assign(new Error(`ENOENT: ${path}`), { code: "ENOENT" });
        },
        watch: vi.fn(
          (
            _path: string,
            _options: unknown,
            listener: typeof watchListener,
          ) => {
            watchListener = listener;
            return { close: vi.fn() };
          },
        ),
      },
    });
    const updates = createUpdates();
    const session = await createWebContainerTerminalRunner().start(
      requestFor(updates),
    );

    watchListener?.(
      "rename",
      new TextEncoder().encode("src/created.ts"),
    );
    await nextTask();

    expect(updates.changes).toEqual([
      { kind: "write", path: "src/created.ts", contents: "created" },
    ]);
    await session.dispose();
  });

  it("mounts parent fixtures outside the project and starts jsh in the workspace", async () => {
    const mounted: unknown[] = [];
    const mkdir = vi.fn(async () => undefined);
    const writeFile = vi.fn(async () => undefined);
    const watcherClose = vi.fn();
    const teardown = vi.fn();
    const shell = createControlledProcess();
    const emptyProcess = () => {
      const process = createControlledProcess();
      process.finish(0);
      return process;
    };
    const spawn = vi.fn(async (command: string) =>
      command === "npm" ? emptyProcess() : shell,
    );
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: async (tree: unknown, options: unknown) => {
        mounted.push([tree, options]);
      },
      spawn,
      teardown,
      fs: {
        mkdir,
        writeFile,
        readdir: async () => [],
        readFile: async () => "",
        watch: vi.fn(() => ({ close: watcherClose })),
      },
    });
    const runner = createWebContainerTerminalRunner();
    const updates = createUpdates();
    const session = await runner.start(
      requestFor(updates, {
        files: {
          "src/main.ts": "main",
          "../fixtures/clinic.ts": "fixture",
        },
        size: { cols: 90, rows: 28 },
      }),
    );

    expect(mounted).toEqual([
      [
        {
          src: { directory: { "main.ts": { file: { contents: "main" } } } },
        },
        { mountPoint: "workspace" },
      ],
    ]);
    expect(mkdir).toHaveBeenCalledWith("fixtures", { recursive: true });
    expect(writeFile).toHaveBeenCalledWith("fixtures/clinic.ts", "fixture");
    expect(spawn).toHaveBeenLastCalledWith("jsh", [], {
      cwd: "workspace",
      terminal: { cols: 90, rows: 28 },
    });

    await session.dispose();
    expect(watcherClose).toHaveBeenCalledOnce();
    expect(teardown).toHaveBeenCalledOnce();
  });

  it("rejects parent paths outside fixtures", async () => {
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: vi.fn(),
      spawn: vi.fn(),
      teardown: vi.fn(),
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
        requestFor(createUpdates(), {
          files: { "src/main.ts": "main", "../private.txt": "escape" },
        }),
      ),
    ).rejects.toThrow("Unsupported external project path: ../private.txt");
  });
});
