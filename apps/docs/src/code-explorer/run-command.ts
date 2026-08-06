export type RunCommand = Readonly<{ command: string; args: readonly string[] }>;
export type RunMode = "test" | "entrypoint";

export const runModeFor = (path: string): RunMode | undefined => {
  if (/^(exercises|test)\/.+\.test\.ts$/.test(path)) return "test";
  return path.endsWith(".ts") ? "entrypoint" : undefined;
};

export const runCommandFor = (path: string): RunCommand | undefined => {
  if (/^exercises\/.+\.test\.ts$/.test(path)) {
    return {
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.exercises.config.ts",
        path,
        "--reporter=verbose",
      ],
    };
  }
  if (/^test\/.+\.test\.ts$/.test(path)) {
    return {
      command: "npx",
      args: [
        "--no-install",
        "vitest",
        "run",
        "--config",
        "vitest.config.ts",
        path,
        "--reporter=verbose",
      ],
    };
  }
  return path.endsWith(".ts")
    ? { command: "npx", args: ["--no-install", "tsx", path] }
    : undefined;
};
