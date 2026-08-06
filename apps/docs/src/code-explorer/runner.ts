import type { FileSystemTree, WebContainer } from "@webcontainer/api";
import type { ProjectFiles } from "./types";
import { runCommandFor, type RunCommand } from "./run-command";

export type RunnerPhase = "booting" | "mounting" | "installing" | "running";
export type RunnerUpdate =
  | Readonly<{ kind: "phase"; phase: RunnerPhase }>
  | Readonly<{ kind: "output"; chunk: string }>
  | Readonly<{ kind: "type-files"; files: ProjectFiles }>;
export type RunRequest = Readonly<{
  filePath: string;
  files: ProjectFiles;
  signal?: AbortSignal;
}>;
export type RunResult = Readonly<{ exitCode: number }>;
export type Runtime = Readonly<{
  mount: (files: ProjectFiles) => Promise<void>;
  install: (
    onOutput: (chunk: string) => void,
    signal?: AbortSignal,
  ) => Promise<number>;
  writeFiles: (files: ProjectFiles) => Promise<void>;
  execute: (
    command: RunCommand,
    onOutput: (chunk: string) => void,
    signal?: AbortSignal,
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
      const throwIfAborted = () => request.signal?.throwIfAborted();
      const command = runCommandFor(request.filePath);
      if (command === undefined) {
        throw new Error(`File cannot be run: ${request.filePath}`);
      }

      throwIfAborted();
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
      throwIfAborted();

      if (mountPromise === undefined) {
        onUpdate({ kind: "phase", phase: "mounting" });
        const mounting = runtime.mount(request.files).catch((error: unknown) => {
          if (mountPromise === mounting) mountPromise = undefined;
          throw error;
        });
        mountPromise = mounting;
      }
      await mountPromise;
      throwIfAborted();

      if (installPromise === undefined) {
        onUpdate({ kind: "phase", phase: "installing" });
        const installing = runtime
          .install((chunk) => {
            onUpdate({ kind: "output", chunk });
          }, request.signal)
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
      throwIfAborted();

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
      throwIfAborted();

      await runtime.writeFiles(request.files);
      throwIfAborted();
      onUpdate({ kind: "phase", phase: "running" });
      const exitCode = await runtime.execute(command, (chunk) => {
        onUpdate({ kind: "output", chunk });
      }, request.signal);
      throwIfAborted();
      return { exitCode };
    },
  };
};

const runProcess = async (
  runtime: WebContainer,
  command: RunCommand,
  onOutput: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<number> => {
  signal?.throwIfAborted();
  const process = await runtime.spawn(command.command, [...command.args], {
    env: { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const stopProcess = () => {
    try {
      process.kill();
    } catch {
      // The process may have exited between the abort event and this callback.
    }
  };
  if (signal?.aborted) {
    stopProcess();
    await Promise.allSettled([process.exit]);
    signal.throwIfAborted();
  }
  signal?.addEventListener("abort", stopProcess, { once: true });
  const outputNormalizer = createPlainTextOutputNormalizer(onOutput);
  const output = process.output.pipeTo(
    new WritableStream<string>({
      write: outputNormalizer.write,
      close: outputNormalizer.close,
    }),
    signal === undefined ? undefined : { signal },
  );
  try {
    const [exitCode] = await Promise.all([process.exit, output]);
    signal?.throwIfAborted();
    return exitCode;
  } catch (error: unknown) {
    if (signal?.aborted) {
      await Promise.allSettled([process.exit, output]);
      signal.throwIfAborted();
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", stopProcess);
  }
};

type TerminalParserState =
  | "text"
  | "escape"
  | "csi"
  | "control-string"
  | "control-string-escape";

const isCsiFinal = (character: string): boolean => {
  const codePoint = character.codePointAt(0)!;
  return codePoint >= 0x40 && codePoint <= 0x7e;
};

const isControlCharacter = (character: string): boolean => {
  const codePoint = character.codePointAt(0)!;
  return codePoint < 0x20 || (codePoint >= 0x7f && codePoint <= 0x9f);
};

const createPlainTextOutputNormalizer = (
  onOutput: (chunk: string) => void,
): Readonly<{ write: (chunk: string) => void; close: () => void }> => {
  let state: TerminalParserState = "text";
  let csiSequence = "";
  let line: string[] = [];
  let cursor = 0;
  let pendingCarriageReturn = false;

  const emitLine = () => {
    onOutput(`${line.join("")}\n`);
    line = [];
    cursor = 0;
  };

  const insertCharacter = (character: string) => {
    while (line.length < cursor) line.push(" ");
    line[cursor] = character;
    cursor += 1;
  };

  const parameterAt = (
    parameters: readonly string[],
    index: number,
    fallback: number,
  ): number => {
    const value = Number.parseInt(parameters[index] ?? "", 10);
    return Number.isNaN(value) ? fallback : value;
  };

  const applyCsi = (sequence: string) => {
    const final = sequence.at(-1);
    if (final === undefined) return;
    const parameterText = sequence.slice(0, -1).replace(/^[?><=]/, "");
    const parameters = parameterText.split(";");

    if (final === "G") {
      cursor = Math.max(0, parameterAt(parameters, 0, 1) - 1);
    } else if (final === "C") {
      cursor += parameterAt(parameters, 0, 1);
    } else if (final === "D") {
      cursor = Math.max(0, cursor - parameterAt(parameters, 0, 1));
    } else if (final === "H" || final === "f") {
      cursor = Math.max(0, parameterAt(parameters, 1, 1) - 1);
    } else if (final === "K") {
      const mode = parameterAt(parameters, 0, 0);
      if (mode === 0) {
        line = line.slice(0, cursor);
      } else if (mode === 1) {
        const lastCell = Math.min(cursor, line.length - 1);
        for (let index = 0; index <= lastCell; index += 1) line[index] = " ";
      } else if (mode === 2) {
        line = [];
      }
    }
  };

  const processTextCharacter = (character: string) => {
    if (pendingCarriageReturn) {
      pendingCarriageReturn = false;
      if (character === "\n") {
        emitLine();
        return;
      }
      cursor = 0;
    }

    if (character === "\x1b") {
      state = "escape";
    } else if (character === "\u009b") {
      state = "csi";
      csiSequence = "";
    } else if (
      character === "\u0090" ||
      character === "\u0098" ||
      character === "\u009d" ||
      character === "\u009e" ||
      character === "\u009f"
    ) {
      state = "control-string";
    } else if (character === "\r") {
      pendingCarriageReturn = true;
    } else if (character === "\n") {
      emitLine();
    } else if (character === "\b") {
      cursor = Math.max(0, cursor - 1);
    } else if (character === "\t" || !isControlCharacter(character)) {
      insertCharacter(character);
    }
  };

  const processCharacter = (character: string) => {
    if (state === "text") {
      processTextCharacter(character);
      return;
    }

    if (state === "escape") {
      if (character === "[") {
        state = "csi";
        csiSequence = "";
      } else if ("]PX^_".includes(character)) {
        state = "control-string";
      } else {
        state = "text";
      }
      return;
    }

    if (state === "csi") {
      if (character === "\x1b") {
        state = "escape";
        csiSequence = "";
      } else if (isCsiFinal(character)) {
        applyCsi(`${csiSequence}${character}`);
        csiSequence = "";
        state = "text";
      } else if (isControlCharacter(character)) {
        csiSequence = "";
        state = "text";
      } else {
        csiSequence += character;
      }
      return;
    }

    if (state === "control-string") {
      if (character === "\x07" || character === "\u009c") {
        state = "text";
      } else if (character === "\x1b") {
        state = "control-string-escape";
      }
      return;
    }

    if (character === "\\" || character === "\u009c") {
      state = "text";
    } else if (character !== "\x1b") {
      state = "control-string";
    }
  };

  return {
    write: (chunk) => {
      for (const character of chunk) processCharacter(character);
    },
    close: () => {
      pendingCarriageReturn = false;
      state = "text";
      csiSequence = "";
      if (line.length > 0) onOutput(line.join(""));
      line = [];
      cursor = 0;
    },
  };
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
  install: async (onOutput, signal) =>
    runProcess(
      runtime,
      {
        command: "npm",
        args: ["install", "--no-progress", "--no-audit", "--no-fund"],
      },
      onOutput,
      signal,
    ),
  writeFiles: async (files) => {
    await Promise.all(
      Object.entries(files).map(([path, source]) => runtime.fs.writeFile(path, source)),
    );
  },
  execute: async (command, onOutput, signal) =>
    runProcess(runtime, command, onOutput, signal),
  readTypeFiles: async () => readExternalTypeFiles(runtime),
});

export const createWebContainerRunner = (): CodeRunner =>
  createCodeRunner(async () => {
    const { WebContainer } = await import("@webcontainer/api");
    return adaptWebContainer(await WebContainer.boot());
  });
