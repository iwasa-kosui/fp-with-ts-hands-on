import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { ProjectFiles } from "./types";

export type TerminalSize = Readonly<{ cols: number; rows: number }>;
export type TerminalPhase =
  | "booting"
  | "mounting"
  | "installing"
  | "collecting-types"
  | "starting-shell";
export type WorkspaceChange =
  | Readonly<{ kind: "write"; path: string; contents: string }>
  | Readonly<{ kind: "delete"; path: string }>;

export type TerminalStartRequest = Readonly<{
  files: ProjectFiles;
  visibleFiles: readonly string[];
  size: TerminalSize;
  signal: AbortSignal;
  onPhase: (phase: TerminalPhase) => void;
  onOutput: (chunk: string) => void;
  onTypeFiles: (files: ProjectFiles) => void;
  onWorkspaceChange: (change: WorkspaceChange) => void;
  onExit: (exitCode: number) => void;
}>;

export type TerminalSession = Readonly<{
  writeInput: (data: string) => Promise<void>;
  writeFile: (path: string, contents: string) => Promise<void>;
  resize: (size: TerminalSize) => void;
  restartShell: (size: TerminalSize) => Promise<void>;
  dispose: () => Promise<void>;
}>;

export type TerminalRunner = Readonly<{
  start: (request: TerminalStartRequest) => Promise<TerminalSession>;
}>;

export type TerminalRuntimeProcess = Readonly<{
  input: WritableStream<string>;
  output: ReadableStream<string>;
  exit: Promise<number>;
  kill: () => void;
  resize: (size: TerminalSize) => void;
}>;

export type TerminalRuntime = Readonly<{
  mount: (files: ProjectFiles) => Promise<void>;
  install: (signal: AbortSignal) => Promise<number>;
  readTypeFiles: () => Promise<ProjectFiles>;
  watchWorkspace: (onPath: (path: string) => void) => () => void;
  readWorkspaceEntry: (path: string) => Promise<WorkspaceEntry>;
  writeWorkspaceFile: (path: string, contents: string) => Promise<void>;
  spawnShell: (size: TerminalSize) => Promise<TerminalRuntimeProcess>;
  dispose: () => void | Promise<void>;
}>;

export type WorkspaceEntry =
  | Readonly<{ kind: "file"; contents: string | Uint8Array }>
  | Readonly<{
      kind: "directory";
      entries: readonly Readonly<{
        name: string;
        kind: "file" | "directory";
      }>[];
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
      const existing = Object.hasOwn(directory, segment)
        ? directory[segment]
        : undefined;
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

const runtimeProjectDirectory = "workspace";
const ignoredDirectories = new Set([
  "node_modules",
  ".cache",
  ".vite",
  ".astro",
  "dist",
  "coverage",
]);

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isMissingPathError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (("code" in error && error.code === "ENOENT") ||
    ("message" in error &&
      typeof error.message === "string" &&
      error.message.startsWith("ENOENT:")));

const normalizeWorkspacePath = (path: string): string | undefined => {
  const slashPath = path.replaceAll("\\", "/");
  const relativePath = slashPath.startsWith(`${runtimeProjectDirectory}/`)
    ? slashPath.slice(runtimeProjectDirectory.length + 1)
    : slashPath;
  const segments = relativePath.split("/");
  if (
    relativePath.startsWith("/") ||
    segments.length === 0 ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return undefined;
  }
  return relativePath;
};

const isIgnoredWorkspacePath = (
  path: string,
  initialVisiblePaths: ReadonlySet<string>,
): boolean => {
  const segments = path.split("/");
  return (
    segments.some((segment) => ignoredDirectories.has(segment)) ||
    (segments.some((segment) => segment.startsWith(".")) &&
      !initialVisiblePaths.has(path)) ||
    segments.at(-1) === "package-lock.json"
  );
};

const decodeTextFile = (contents: string | Uint8Array): string | undefined => {
  try {
    const decoded =
      typeof contents === "string"
        ? contents
        : new TextDecoder("utf-8", { fatal: true }).decode(contents);
    return decoded.includes("\0") ? undefined : decoded;
  } catch {
    return undefined;
  }
};

const abortError = (): DOMException =>
  new DOMException("Terminal startup was aborted", "AbortError");

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw signal.reason ?? abortError();
};

type ActiveShell = Readonly<{
  generation: number;
  process: TerminalRuntimeProcess;
  writer: WritableStreamDefaultWriter<string>;
  outputDone: Promise<void>;
}>;

export const createTerminalRunner = (
  loadRuntime: () => Promise<TerminalRuntime>,
): TerminalRunner => ({
  start: async (request) => {
    let runtime: TerminalRuntime | undefined;
    let stopWatching: (() => void) | undefined;
    let activeShell: ActiveShell | undefined;
    let shellGeneration = 0;
    let disposed = false;
    let fileEventQueue = Promise.resolve();
    const projectedFiles = new Map<string, string>();
    const initialProjectPaths = new Set(
      Object.keys(request.files).filter((path) => !path.startsWith("../")),
    );
    const initialVisiblePaths = new Set(request.visibleFiles);
    for (const path of request.visibleFiles) {
      const contents = request.files[path];
      if (contents !== undefined) projectedFiles.set(path, contents);
    }

    const stopShell = async () => {
      const shell = activeShell;
      if (shell === undefined) return;
      activeShell = undefined;
      try {
        shell.process.kill();
      } catch {
        // The shell may already have exited.
      }
      await Promise.allSettled([shell.process.exit, shell.outputDone]);
      shell.writer.releaseLock();
    };

    const spawnShell = async (size: TerminalSize) => {
      if (runtime === undefined) throw new Error("Runtime is not available");
      const process = await runtime.spawnShell(size);
      const generation = ++shellGeneration;
      const writer = process.input.getWriter();
      const outputDone = process.output
        .pipeTo(
          new WritableStream<string>({
            write: (chunk) => {
              if (!disposed && !request.signal.aborted) {
                request.onOutput(chunk);
              }
            },
          }),
        )
        .catch((error: unknown) => {
          if (!disposed && !request.signal.aborted) {
            request.onOutput(
              `\r\n[ターミナルエラー] ${errorMessage(error)}\r\n`,
            );
          }
        });
      const shell = { generation, process, writer, outputDone };
      activeShell = shell;
      void process.exit
        .then(async (exitCode) => {
          await outputDone;
          if (
            !disposed &&
            activeShell?.generation === generation
          ) {
            request.onExit(exitCode);
          }
        })
        .catch((error: unknown) => {
          if (!disposed && !request.signal.aborted) {
            request.onOutput(`\r\n[ターミナルエラー] ${errorMessage(error)}\r\n`);
            if (activeShell?.generation === generation) request.onExit(1);
          }
        });
    };

    const removeProjectedPath = (path: string) => {
      for (const projectedPath of [...projectedFiles.keys()]) {
        if (
          projectedPath !== path &&
          !projectedPath.startsWith(`${path}/`)
        ) {
          continue;
        }
        projectedFiles.delete(projectedPath);
        request.onWorkspaceChange({ kind: "delete", path: projectedPath });
      }
    };

    const synchronizePath = async (rawPath: string) => {
      if (runtime === undefined || disposed) return;
      const path = normalizeWorkspacePath(rawPath);
      if (
        path === undefined ||
        isIgnoredWorkspacePath(path, initialVisiblePaths)
      ) {
        return;
      }
      if (initialProjectPaths.has(path) && !initialVisiblePaths.has(path)) {
        return;
      }

      try {
        const entry = await runtime.readWorkspaceEntry(path);
        if (disposed || request.signal.aborted) return;
        if (entry.kind === "directory") {
          const currentChildren = new Set(
            entry.entries.map(({ name }) => `${path}/${name}`),
          );
          for (const projectedPath of [...projectedFiles.keys()]) {
            if (!projectedPath.startsWith(`${path}/`)) continue;
            const relativePath = projectedPath.slice(path.length + 1);
            const immediateChild = `${path}/${relativePath.split("/")[0]}`;
            if (!currentChildren.has(immediateChild)) {
              removeProjectedPath(immediateChild);
            }
          }
          for (const child of entry.entries) {
            await synchronizePath(`${path}/${child.name}`);
          }
          return;
        }
        const contents = decodeTextFile(entry.contents);
        if (contents === undefined) {
          removeProjectedPath(path);
          return;
        }
        if (projectedFiles.get(path) === contents) return;
        projectedFiles.set(path, contents);
        request.onWorkspaceChange({ kind: "write", path, contents });
      } catch (error: unknown) {
        if (!isMissingPathError(error)) throw error;
        removeProjectedPath(path);
      }
    };

    try {
      throwIfAborted(request.signal);
      request.onPhase("booting");
      runtime = await loadRuntime();
      throwIfAborted(request.signal);

      request.onPhase("mounting");
      await runtime.mount(request.files);
      throwIfAborted(request.signal);

      request.onPhase("installing");
      const installExitCode = await runtime.install(request.signal);
      throwIfAborted(request.signal);
      if (installExitCode !== 0) {
        throw new Error(
          `Dependency installation failed with exit code ${installExitCode}`,
        );
      }

      request.onPhase("collecting-types");
      request.onTypeFiles(await runtime.readTypeFiles());
      throwIfAborted(request.signal);

      stopWatching = runtime.watchWorkspace((path) => {
        fileEventQueue = fileEventQueue
          .then(() => synchronizePath(path))
          .catch((error: unknown) => {
            if (!disposed) {
              request.onOutput(
                `\r\n[ファイル同期エラー] ${errorMessage(error)}\r\n`,
              );
            }
          });
      });

      request.onPhase("starting-shell");
      await spawnShell(request.size);
      throwIfAborted(request.signal);

      return {
        writeInput: async (data) => {
          const writer = activeShell?.writer;
          if (writer === undefined) throw new Error("Shell is not running");
          await writer.write(data);
        },
        writeFile: async (rawPath, contents) => {
          const path = normalizeWorkspacePath(rawPath);
          if (runtime === undefined || path === undefined) {
            throw new Error(`Unsupported workspace path: ${rawPath}`);
          }
          await runtime.writeWorkspaceFile(path, contents);
        },
        resize: (size) => activeShell?.process.resize(size),
        restartShell: async (size) => {
          await stopShell();
          if (disposed) throw new Error("Terminal session is disposed");
          await spawnShell(size);
        },
        dispose: async () => {
          if (disposed) return;
          disposed = true;
          stopWatching?.();
          stopWatching = undefined;
          await stopShell();
          await fileEventQueue;
          await runtime?.dispose();
          runtime = undefined;
        },
      };
    } catch (error: unknown) {
      disposed = true;
      stopWatching?.();
      await fileEventQueue;
      await stopShell();
      await runtime?.dispose();
      throw error;
    }
  },
});

const readExternalTypeFiles = async (
  runtime: WebContainer,
): Promise<ProjectFiles> => {
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
          const projectPath = path.replace(`${runtimeProjectDirectory}/`, "");
          files[`file:///${projectPath}`] = await runtime.fs.readFile(
            path,
            "utf8",
          );
        }
      }),
    );
  };

  const visitIfPresent = async (directory: string): Promise<void> => {
    try {
      await visit(directory);
    } catch (error: unknown) {
      if (!isMissingPathError(error)) throw error;
    }
  };

  await Promise.all(
    ["node_modules/zod", "node_modules/vitest", "node_modules/@vitest"].map(
      (directory) =>
        visitIfPresent(`${runtimeProjectDirectory}/${directory}`),
    ),
  );
  return files;
};

const splitProjectFiles = (
  files: ProjectFiles,
): Readonly<{ internal: ProjectFiles; parent: ProjectFiles }> => {
  const internal: Record<string, string> = {};
  const parent: Record<string, string> = {};
  for (const [path, source] of Object.entries(files)) {
    if (!path.startsWith("../")) {
      internal[path] = source;
      continue;
    }

    const parentPath = path.slice(3);
    const segments = parentPath.split("/");
    if (
      !parentPath.startsWith("fixtures/") ||
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    ) {
      throw new Error(`Unsupported external project path: ${path}`);
    }
    parent[parentPath] = source;
  }
  return { internal, parent };
};

const writeParentFiles = async (
  runtime: WebContainer,
  files: ProjectFiles,
): Promise<void> => {
  for (const [path, source] of Object.entries(files)) {
    const directory = path.slice(0, path.lastIndexOf("/"));
    await runtime.fs.mkdir(directory, { recursive: true });
    await runtime.fs.writeFile(path, source);
  }
};

const runInstallation = async (
  runtime: WebContainer,
  signal: AbortSignal,
): Promise<number> => {
  const process = await runtime.spawn(
    "npm",
    ["install", "--no-progress", "--no-audit", "--no-fund"],
    {
      cwd: runtimeProjectDirectory,
      env: { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
    },
  );
  const stop = () => process.kill();
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  try {
    const output = process.output.pipeTo(new WritableStream<string>());
    const [exitCode] = await Promise.all([process.exit, output]);
    return exitCode;
  } finally {
    signal.removeEventListener("abort", stop);
  }
};

const adaptWebContainer = (runtime: WebContainer): TerminalRuntime => ({
  mount: async (files) => {
    const { internal, parent } = splitProjectFiles(files);
    await runtime.fs.mkdir(runtimeProjectDirectory, { recursive: true });
    await runtime.mount(buildFileSystemTree(internal), {
      mountPoint: runtimeProjectDirectory,
    });
    await writeParentFiles(runtime, parent);
  },
  install: async (signal) => runInstallation(runtime, signal),
  readTypeFiles: async () => readExternalTypeFiles(runtime),
  watchWorkspace: (onPath) => {
    const watcher = runtime.fs.watch(
      runtimeProjectDirectory,
      { recursive: true },
      (_event, filename) => {
        const path =
          typeof filename === "string"
            ? filename
            : new TextDecoder().decode(filename);
        onPath(path);
      },
    );
    return () => watcher.close();
  },
  readWorkspaceEntry: async (path) => {
    const runtimePath = `${runtimeProjectDirectory}/${path}`;
    try {
      return { kind: "file", contents: await runtime.fs.readFile(runtimePath) };
    } catch (fileError: unknown) {
      if (isMissingPathError(fileError)) throw fileError;
      try {
        const entries = await runtime.fs.readdir(runtimePath, {
          withFileTypes: true,
        });
        return {
          kind: "directory",
          entries: entries.map((entry) => ({
            name: entry.name,
            kind: entry.isDirectory() ? "directory" : "file",
          })),
        };
      } catch {
        throw fileError;
      }
    }
  },
  writeWorkspaceFile: async (path, contents) => {
    await runtime.fs.writeFile(`${runtimeProjectDirectory}/${path}`, contents);
  },
  spawnShell: async (size) => {
    const process = await runtime.spawn("jsh", [], {
      cwd: runtimeProjectDirectory,
      terminal: size,
    });
    return {
      input: process.input,
      output: process.output,
      exit: process.exit,
      kill: () => process.kill(),
      resize: (nextSize) => process.resize(nextSize),
    };
  },
  dispose: () => runtime.teardown(),
});

export const createWebContainerTerminalRunner = (): TerminalRunner =>
  createTerminalRunner(async () => {
    const { WebContainer } = await import("@webcontainer/api");
    return adaptWebContainer(await WebContainer.boot());
  });
