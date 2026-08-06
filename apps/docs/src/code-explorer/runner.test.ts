import { describe, expect, it, vi } from "vitest";
import { runCommandFor } from "./run-command";
import {
  buildFileSystemTree,
  createCodeRunner,
  createWebContainerRunner,
  type RunnerUpdate,
  type Runtime,
} from "./runner";

const webContainerMock = vi.hoisted(() => ({
  boot: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@webcontainer/api", () => ({
  WebContainer: { boot: webContainerMock.boot },
}));

const createInMemoryRuntime = (): Runtime &
  Readonly<{
    files: Map<string, string>;
    installCount: number;
    executedFiles: readonly string[];
    executedSources: readonly (string | undefined)[];
  }> => {
  const files = new Map<string, string>();
  const executedFiles: string[] = [];
  const executedSources: (string | undefined)[] = [];
  let installCount = 0;
  return {
    files,
    executedFiles,
    executedSources,
    get installCount() {
      return installCount;
    },
    mount: async (mounted) => {
      for (const [path, source] of Object.entries(mounted)) files.set(`/${path}`, source);
    },
    install: async (onOutput) => {
      installCount += 1;
      onOutput("installed\n");
      return 0;
    },
    writeFiles: async (edited) => {
      for (const [path, source] of Object.entries(edited)) files.set(`/${path}`, source);
    },
    execute: async (command, onOutput) => {
      const selected = [...command.args].reverse().find((arg) => arg.endsWith(".ts"));
      if (selected !== undefined) {
        executedFiles.push(selected);
        executedSources.push(files.get(`/${selected}`));
      }
      onOutput("ok\n");
      return 0;
    },
    readTypeFiles: async () => ({}),
  };
};

describe("single-file execution", () => {
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
    expect(() => buildFileSystemTree({ "src//main.ts": "" })).toThrow(/empty path segment/i);
    expect(() =>
      buildFileSystemTree({ src: "file", "src/main.ts": "nested" }),
    ).toThrow(/collision/i);
    expect(() =>
      buildFileSystemTree({ "src/main.ts": "nested", src: "file" }),
    ).toThrow(/collision/i);
  });

  it("selects one fixed command by file kind", () => {
    expect(runCommandFor("exercises/02-boundary-and-ids.test.ts")).toEqual({
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.exercises.config.ts",
        "exercises/02-boundary-and-ids.test.ts",
        "--reporter=verbose",
      ],
    });
    expect(runCommandFor("test/02-boundary-and-ids.test.ts")).toEqual({
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.config.ts",
        "test/02-boundary-and-ids.test.ts",
        "--reporter=verbose",
      ],
    });
    expect(runCommandFor("src/clinic/appointment.ts")).toEqual({
      command: "npx",
      args: ["--no-install", "tsx", "src/clinic/appointment.ts"],
    });
    expect(runCommandFor("package.json")).toBeUndefined();
  });

  it("installs once and writes the latest edits before each run", async () => {
    const runtime = createInMemoryRuntime();
    const runner = createCodeRunner(async () => runtime);
    const updates: string[] = [];

    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('first')", "package.json": "{}" },
      },
      (update) => {
        if (update.kind === "phase") updates.push(update.phase);
      },
    );
    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('second')", "package.json": "{}" },
      },
      () => undefined,
    );

    expect(runtime.installCount).toBe(1);
    expect(runtime.files.get("/src/main.ts")).toBe("console.log('second')");
    expect(runtime.executedFiles).toEqual(["src/main.ts", "src/main.ts"]);
    expect(runtime.executedSources).toEqual([
      "console.log('first')",
      "console.log('second')",
    ]);
    expect(updates).toEqual(["booting", "mounting", "installing", "running"]);
  });

  it("retries boot after loading the runtime fails", async () => {
    const runtime = createInMemoryRuntime();
    let loadCount = 0;
    const runner = createCodeRunner(async () => {
      loadCount += 1;
      if (loadCount === 1) throw new Error("boot failed");
      return runtime;
    });
    const request = { filePath: "src/main.ts", files: { "src/main.ts": "" } };

    await expect(runner.run(request, () => undefined)).rejects.toThrow("boot failed");
    await expect(runner.run(request, () => undefined)).resolves.toEqual({ exitCode: 0 });

    expect(loadCount).toBe(2);
    expect(runtime.executedFiles).toEqual(["src/main.ts"]);
  });

  it("retries a failed install without executing the selected file", async () => {
    let installCount = 0;
    const executedFiles: string[] = [];
    const runtime: Runtime = {
      mount: async () => undefined,
      install: async () => {
        installCount += 1;
        return installCount === 1 ? 1 : 0;
      },
      writeFiles: async () => undefined,
      execute: async (command) => {
        const selected = [...command.args].reverse().find((arg) => arg.endsWith(".ts"));
        if (selected !== undefined) executedFiles.push(selected);
        return 0;
      },
      readTypeFiles: async () => ({}),
    };
    const runner = createCodeRunner(async () => runtime);
    const request = { filePath: "src/main.ts", files: { "src/main.ts": "" } };

    await expect(runner.run(request, () => undefined)).rejects.toThrow(
      "Dependency installation failed with exit code 1",
    );
    expect(executedFiles).toEqual([]);

    await expect(runner.run(request, () => undefined)).resolves.toEqual({ exitCode: 0 });
    expect(installCount).toBe(2);
    expect(executedFiles).toEqual(["src/main.ts"]);
  });

  it("adapts WebContainer lazily and streams install and run output", async () => {
    const outputStream = (chunks: readonly string[]) =>
      new ReadableStream<string>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    const spawn = vi.fn(
      async (
        command: string,
        _args: readonly string[],
        _options: Readonly<{ env: Readonly<Record<string, string>> }>,
      ) => ({
        exit: Promise.resolve(0),
        output: outputStream(
          command === "npm" ? ["install out\n", "install err\n"] : ["run out\n", "run err\n"],
        ),
      }),
    );
    const entry = (name: string, kind: "file" | "directory") => ({
      name,
      isFile: () => kind === "file",
      isDirectory: () => kind === "directory",
    });
    const directoryEntries: Record<string, ReturnType<typeof entry>[]> = {
      "node_modules/zod": [entry("index.d.ts", "file"), entry("index.js", "file")],
      "node_modules/vitest": [entry("package.json", "file"), entry("index.d.ts", "file")],
      "node_modules/@vitest": [entry("expect", "directory")],
      "node_modules/@vitest/expect": [
        entry("package.json", "file"),
        entry("index.d.ts", "file"),
      ],
    };
    const typeSources: Record<string, string> = {
      "node_modules/zod/index.d.ts": "zod types",
      "node_modules/vitest/package.json": "vitest package",
      "node_modules/vitest/index.d.ts": "vitest types",
      "node_modules/@vitest/expect/package.json": "expect package",
      "node_modules/@vitest/expect/index.d.ts": "expect types",
    };
    const mounted: unknown[] = [];
    const written = new Map<string, string>();
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: async (tree: unknown) => {
        mounted.push(tree);
      },
      spawn,
      fs: {
        writeFile: async (path: string, source: string) => {
          written.set(path, source);
        },
        readdir: async (path: string) => directoryEntries[path] ?? [],
        readFile: async (path: string) => typeSources[path],
      },
    });
    const runner = createWebContainerRunner();
    const updates: RunnerUpdate[] = [];

    expect(webContainerMock.boot).not.toHaveBeenCalled();
    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('first')", "package.json": "{}" },
      },
      (update) => updates.push(update),
    );
    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('second')", "package.json": "{}" },
      },
      (update) => updates.push(update),
    );

    expect(webContainerMock.boot).toHaveBeenCalledTimes(1);
    expect(mounted).toEqual([
      {
        src: { directory: { "main.ts": { file: { contents: "console.log('first')" } } } },
        "package.json": { file: { contents: "{}" } },
      },
    ]);
    expect(written.get("src/main.ts")).toBe("console.log('second')");
    expect(spawn).toHaveBeenNthCalledWith(1, "npm", ["install"], {
      env: { NO_COLOR: "1", FORCE_COLOR: "0" },
    });
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      "npx",
      ["--no-install", "tsx", "src/main.ts"],
      { env: { NO_COLOR: "1", FORCE_COLOR: "0" } },
    );
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(updates.filter((update) => update.kind === "output")).toEqual([
      { kind: "output", chunk: "install out\n" },
      { kind: "output", chunk: "install err\n" },
      { kind: "output", chunk: "run out\n" },
      { kind: "output", chunk: "run err\n" },
      { kind: "output", chunk: "run out\n" },
      { kind: "output", chunk: "run err\n" },
    ]);
    expect(updates.filter((update) => update.kind === "type-files")).toEqual([
      {
        kind: "type-files",
        files: {
          "file:///node_modules/zod/index.d.ts": "zod types",
          "file:///node_modules/vitest/package.json": "vitest package",
          "file:///node_modules/vitest/index.d.ts": "vitest types",
          "file:///node_modules/@vitest/expect/package.json": "expect package",
          "file:///node_modules/@vitest/expect/index.d.ts": "expect types",
        },
      },
    ]);
  });
});
