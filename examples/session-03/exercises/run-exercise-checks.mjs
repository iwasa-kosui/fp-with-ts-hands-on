import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const commands = [
  ["pnpm", ["exec", "tsc", "-p", "tsconfig.exercises.json", "--noEmit", "--locale", "ja"]],
  ["pnpm", ["exec", "vitest", "run", "--config", "vitest.exercises.config.ts"]],
];

const participantMessage = (line) => {
  const diagnostic = line.match(/^(.+)\((\d+),\d+\): error TS\d+:/);
  if (diagnostic === null) return line;
  const [, file, lineNumberText] = diagnostic;
  const lineNumber = Number(lineNumberText);
  const sourceLine = readFileSync(file, "utf8").split("\n")[lineNumber - 1] ?? "";
  const reason = sourceLine.match(/(?:@ts-expect-error|要件:)\s+(.+)/)?.[1];
  return reason === undefined
    ? line
    : `${file}:${lineNumber} - 要件未達: ${reason}`;
};

let failed = false;
for (const [command, args] of commands) {
  const capturesTypeDiagnostics = args.includes("tsc");
  const result = spawnSync(command, args, {
    encoding: capturesTypeDiagnostics ? "utf8" : undefined,
    stdio: capturesTypeDiagnostics ? "pipe" : "inherit",
  });
  if (capturesTypeDiagnostics) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
      .split("\n")
      .map(participantMessage)
      .join("\n");
    process.stdout.write(output);
  }
  if (result.status !== 0) failed = true;
}

process.exitCode = failed ? 1 : 0;
