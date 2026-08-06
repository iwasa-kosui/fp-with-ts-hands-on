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

  it("retries mount on the retained runtime without booting again", async () => {
    let loadCount = 0;
    let mountCount = 0;
    const phases: string[] = [];
    const runtime: Runtime = {
      mount: async () => {
        mountCount += 1;
        if (mountCount === 1) throw new Error("mount failed");
      },
      install: async () => 0,
      writeFiles: async () => undefined,
      execute: async () => 0,
      readTypeFiles: async () => ({}),
    };
    const runner = createCodeRunner(async () => {
      loadCount += 1;
      return runtime;
    });
    const request = { filePath: "src/main.ts", files: { "src/main.ts": "" } };
    const onUpdate = (update: RunnerUpdate) => {
      if (update.kind === "phase") phases.push(update.phase);
    };

    await expect(runner.run(request, onUpdate)).rejects.toThrow("mount failed");
    await expect(runner.run(request, onUpdate)).resolves.toEqual({ exitCode: 0 });

    expect(loadCount).toBe(1);
    expect(mountCount).toBe(2);
    expect(phases).toEqual(["booting", "mounting", "mounting", "installing", "running"]);
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

  it("retries declaration collection without reinstalling dependencies", async () => {
    let installCount = 0;
    let typeReadCount = 0;
    let executeCount = 0;
    const runtime: Runtime = {
      mount: async () => undefined,
      install: async () => {
        installCount += 1;
        return 0;
      },
      writeFiles: async () => undefined,
      execute: async () => {
        executeCount += 1;
        return 0;
      },
      readTypeFiles: async () => {
        typeReadCount += 1;
        if (typeReadCount === 1) throw new Error("type read failed");
        return { "file:///node_modules/zod/index.d.cts": "zod types" };
      },
    };
    const runner = createCodeRunner(async () => runtime);
    const request = { filePath: "src/main.ts", files: { "src/main.ts": "" } };
    const updates: RunnerUpdate[] = [];

    await expect(runner.run(request, () => undefined)).rejects.toThrow("type read failed");
    await expect(runner.run(request, (update) => updates.push(update))).resolves.toEqual({
      exitCode: 0,
    });

    expect(installCount).toBe(1);
    expect(typeReadCount).toBe(2);
    expect(executeCount).toBe(1);
    expect(updates.filter((update) => update.kind === "type-files")).toEqual([
      {
        kind: "type-files",
        files: { "file:///node_modules/zod/index.d.cts": "zod types" },
      },
    ]);
  });

  it.each([
    {
      name: "bare carriage return overwrites from column zero across chunks",
      chunks: ["abcdef", "\r", "XY\n"],
      expected: "XYcdef\n",
    },
    {
      name: "CSI 1K erases through the cursor without shifting the suffix",
      chunks: ["abcdef\x1b[3G", "\x1b[1KXY\n"],
      expected: "  XYef\n",
    },
    {
      name: "CSI 2K clears the line without resetting the cursor column",
      chunks: ["abcdef\x1b[3G", "\x1b[2KXY\n"],
      expected: "  XY\n",
    },
  ])("normalizes terminal cursor semantics: $name", async ({ chunks, expected }) => {
    const outputStream = (streamChunks: readonly string[]) =>
      new ReadableStream<string>({
        start(controller) {
          for (const chunk of streamChunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    const spawn = vi.fn(async (command: string) => ({
      exit: Promise.resolve(0),
      output: outputStream(command === "npm" ? [] : chunks),
    }));
    webContainerMock.boot.mockReset();
    webContainerMock.boot.mockResolvedValue({
      mount: async () => undefined,
      spawn,
      fs: {
        writeFile: async () => undefined,
        readdir: async () => [],
        readFile: async () => "",
      },
    });
    const runner = createWebContainerRunner();
    const output: string[] = [];

    await runner.run(
      { filePath: "src/main.ts", files: { "src/main.ts": "" } },
      (update) => {
        if (update.kind === "output") output.push(update.chunk);
      },
    );

    expect(output.join("")).toBe(expected);
  });

  it("adapts WebContainer lazily and streams normalized install and run output", async () => {
    const outputStream = (chunks: readonly string[]) =>
      new ReadableStream<string>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });
    let executionCount = 0;
    const spawn = vi.fn(
      async (
        command: string,
        _args: readonly string[],
        _options: Readonly<{ env: Readonly<Record<string, string>> }>,
      ) => {
        if (command === "npm") {
          return {
            exit: Promise.resolve(0),
            output: outputStream([
              "working",
              "\r⠋\x1b[1",
              "G\x1b[0Kinstalled\r",
              "\n",
            ]),
          };
        }
        executionCount += 1;
        return {
          exit: Promise.resolve(0),
          output: outputStream(
            executionCount === 1
              ? ["\x1b[3", "2m1 test passed\r", "\n\x1b[?2", "5h"]
              : ["✓ 日本", "語\nordinary trailing text"],
          ),
        };
      },
    );
    const entry = (name: string, kind: "file" | "directory") => ({
      name,
      isFile: () => kind === "file",
      isDirectory: () => kind === "directory",
    });
    const directoryEntries: Record<string, ReturnType<typeof entry>[]> = {
      "node_modules/zod": [
        entry("package.json", "file"),
        entry("index.d.cts", "file"),
        entry("index.d.mts", "file"),
        entry("index.js", "file"),
      ],
      "node_modules/vitest": [entry("package.json", "file"), entry("index.d.ts", "file")],
      "node_modules/@vitest": [entry("expect", "directory")],
      "node_modules/@vitest/expect": [
        entry("package.json", "file"),
        entry("index.d.ts", "file"),
      ],
    };
    const typeSources: Record<string, string> = {
      "node_modules/zod/package.json": "{\"types\":\"./index.d.cts\"}",
      "node_modules/zod/index.d.cts": "zod commonjs types",
      "node_modules/zod/index.d.mts": "zod module types",
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
    const outputText = () =>
      updates
        .filter((update) => update.kind === "output")
        .map((update) => update.chunk)
        .join("");

    expect(webContainerMock.boot).not.toHaveBeenCalled();
    await runner.run(
      {
        filePath: "src/main.ts",
        files: { "src/main.ts": "console.log('first')", "package.json": "{}" },
      },
      (update) => updates.push(update),
    );
    expect(outputText()).toBe("installed\n1 test passed\n");
    expect(outputText()).not.toMatch(/[\u001b\u009b\r]/);

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
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      "npm",
      ["install", "--no-progress", "--no-audit", "--no-fund"],
      { env: { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" } },
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      "npx",
      ["--no-install", "tsx", "src/main.ts"],
      { env: { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" } },
    );
    expect(spawn).toHaveBeenCalledTimes(3);
    expect(outputText()).toBe(
      "installed\n1 test passed\n✓ 日本語\nordinary trailing text",
    );
    expect(updates.filter((update) => update.kind === "type-files")).toEqual([
      {
        kind: "type-files",
        files: {
          "file:///node_modules/zod/package.json": "{\"types\":\"./index.d.cts\"}",
          "file:///node_modules/zod/index.d.cts": "zod commonjs types",
          "file:///node_modules/zod/index.d.mts": "zod module types",
          "file:///node_modules/vitest/package.json": "vitest package",
          "file:///node_modules/vitest/index.d.ts": "vitest types",
          "file:///node_modules/@vitest/expect/package.json": "expect package",
          "file:///node_modules/@vitest/expect/index.d.ts": "expect types",
        },
      },
    ]);
  });
});
