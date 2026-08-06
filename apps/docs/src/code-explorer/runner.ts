import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { ProjectFiles } from "./types";
import { runCommandFor, type RunCommand } from "./run-command";

export type RunnerPhase = "booting" | "mounting" | "installing" | "running";
export type RunnerUpdate =
  | Readonly<{ kind: "phase"; phase: RunnerPhase }>
  | Readonly<{ kind: "output"; chunk: string }>
  | Readonly<{ kind: "type-files"; files: ProjectFiles }>;
export type RunRequest = Readonly<{ filePath: string; files: ProjectFiles }>;
export type RunResult = Readonly<{ exitCode: number }>;
export type Runtime = Readonly<{
  mount: (files: ProjectFiles) => Promise<void>;
  install: (onOutput: (chunk: string) => void) => Promise<number>;
  writeFiles: (files: ProjectFiles) => Promise<void>;
  execute: (
    command: RunCommand,
    onOutput: (chunk: string) => void,
  ) => Promise<number>;
  readTypeFiles: () => Promise<ProjectFiles>;
}>;
export type CodeRunner = Readonly<{
  run: (
    request: RunRequest,
    onUpdate: (update: RunnerUpdate) => void,
  ) => Promise<RunResult>;
}>;

export const buildFileSystemTree = (files: ProjectFiles): FileSystemTree => {
  const tree: FileSystemTree = {};

  for (const [path, contents] of Object.entries(files)) {
    const segments = path.split("/");
    if (segments.some((segment) => segment.length === 0)) {
      throw new Error(`File path contains an empty path segment: ${path}`);
    }

    let directory = tree;
    for (const segment of segments.slice(0, -1)) {
      const existing = Object.hasOwn(directory, segment) ? directory[segment] : undefined;
      if (existing === undefined) {
        const child: FileSystemTree = {};
        directory[segment] = { directory: child };
        directory = child;
      } else if ("directory" in existing) {
        directory = existing.directory;
      } else {
        throw new Error(`File-directory collision at: ${segment}`);
      }
    }

    const fileName = segments.at(-1)!;
    if (Object.hasOwn(directory, fileName)) {
      throw new Error(`File-directory collision at: ${path}`);
    }
    directory[fileName] = { file: { contents } };
  }

  return tree;
};

export const createCodeRunner = (
  loadRuntime: () => Promise<Runtime>,
): CodeRunner => {
  let runtimePromise: Promise<Runtime> | undefined;
  let mountPromise: Promise<void> | undefined;
  let installPromise: Promise<void> | undefined;
  let typeFilesPromise: Promise<void> | undefined;

  return {
    run: async (request, onUpdate) => {
      const command = runCommandFor(request.filePath);
      if (command === undefined) {
        throw new Error(`File cannot be run: ${request.filePath}`);
      }

      if (runtimePromise === undefined) {
        onUpdate({ kind: "phase", phase: "booting" });
        const loading = loadRuntime()
          .catch((error: unknown) => {
            if (runtimePromise === loading) runtimePromise = undefined;
            throw error;
          });
        runtimePromise = loading;
      }
      const runtime = await runtimePromise;

      if (mountPromise === undefined) {
        onUpdate({ kind: "phase", phase: "mounting" });
        const mounting = runtime.mount(request.files).catch((error: unknown) => {
          if (mountPromise === mounting) mountPromise = undefined;
          throw error;
        });
        mountPromise = mounting;
      }
      await mountPromise;

      if (installPromise === undefined) {
        onUpdate({ kind: "phase", phase: "installing" });
        const installing = runtime
          .install((chunk) => {
            onUpdate({ kind: "output", chunk });
          })
          .then((exitCode) => {
            if (exitCode !== 0) {
              throw new Error(`Dependency installation failed with exit code ${exitCode}`);
            }
          })
          .catch((error: unknown) => {
            if (installPromise === installing) installPromise = undefined;
            throw error;
          });
        installPromise = installing;
      }
      await installPromise;

      if (typeFilesPromise === undefined) {
        const readingTypeFiles = runtime
          .readTypeFiles()
          .then((files) => {
            onUpdate({ kind: "type-files", files });
          })
          .catch((error: unknown) => {
            if (typeFilesPromise === readingTypeFiles) typeFilesPromise = undefined;
            throw error;
          });
        typeFilesPromise = readingTypeFiles;
      }
      await typeFilesPromise;

      await runtime.writeFiles(request.files);
      onUpdate({ kind: "phase", phase: "running" });
      const exitCode = await runtime.execute(command, (chunk) => {
        onUpdate({ kind: "output", chunk });
      });
      return { exitCode };
    },
  };
};

const runProcess = async (
  runtime: WebContainer,
  command: RunCommand,
  onOutput: (chunk: string) => void,
): Promise<number> => {
  const process = await runtime.spawn(command.command, [...command.args], {
    env: { NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const output = process.output.pipeTo(
    new WritableStream<string>({
      write: (chunk) => onOutput(chunk),
    }),
  );
  const [exitCode] = await Promise.all([process.exit, output]);
  return exitCode;
};

const readExternalTypeFiles = async (runtime: WebContainer): Promise<ProjectFiles> => {
  const files: Record<string, string> = {};

  const visit = async (directory: string): Promise<void> => {
    const entries = await runtime.fs.readdir(directory, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) {
          await visit(path);
        } else if (
          entry.isFile() &&
          (/\.d\.[cm]?ts$/.test(entry.name) || entry.name === "package.json")
        ) {
          files[`file:///${path}`] = await runtime.fs.readFile(path, "utf8");
        }
      }),
    );
  };

  await Promise.all(
    ["node_modules/zod", "node_modules/vitest", "node_modules/@vitest"].map(visit),
  );
  return files;
};

const adaptWebContainer = (runtime: WebContainer): Runtime => ({
  mount: async (files) => runtime.mount(buildFileSystemTree(files)),
  install: async (onOutput) =>
    runProcess(runtime, { command: "npm", args: ["install"] }, onOutput),
  writeFiles: async (files) => {
    await Promise.all(
      Object.entries(files).map(([path, source]) => runtime.fs.writeFile(path, source)),
    );
  },
  execute: async (command, onOutput) => runProcess(runtime, command, onOutput),
  readTypeFiles: async () => readExternalTypeFiles(runtime),
});

export const createWebContainerRunner = (): CodeRunner =>
  createCodeRunner(async () => {
    const { WebContainer } = await import("@webcontainer/api");
    return adaptWebContainer(await WebContainer.boot());
  });
