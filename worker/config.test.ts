import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWorkerRoute } from "./routes";

type WranglerConfig = Readonly<{
  assets?: Readonly<{ run_worker_first?: readonly string[] }>;
}>;

type RootPackage = Readonly<{
  scripts?: Readonly<Record<string, string>>;
}>;

const stripJsonComments = (source: string): string => {
  let output = "";
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n" || character === "\r") {
        lineComment = false;
        output += character;
      } else {
        output += " ";
      }
      continue;
    }

    if (blockComment) {
      if (character === "*" && next === "/") {
        output += "  ";
        index += 1;
        blockComment = false;
      } else {
        output += character === "\n" || character === "\r" ? character : " ";
      }
      continue;
    }

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
    } else if (character === "/" && next === "/") {
      output += "  ";
      index += 1;
      lineComment = true;
    } else if (character === "/" && next === "*") {
      output += "  ";
      index += 1;
      blockComment = true;
    } else {
      output += character;
    }
  }

  return output;
};

const stripTrailingCommas = (source: string): string => {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (character === ",") {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] ?? "")) lookahead += 1;
      if (source[lookahead] === "]" || source[lookahead] === "}") continue;
    }

    output += character;
  }

  return output;
};

const parseJsonc = <T>(source: string): T =>
  JSON.parse(stripTrailingCommas(stripJsonComments(source))) as T;

const retiredCurriculumRedirects = [
  "/sessions/04-agent-review",
  "/sessions/04-agent-review/",
  "/sessions/05-mini-integration",
  "/sessions/05-mini-integration/",
] as const;

const repositoryRoot = resolve(process.cwd(), "../..");

describe("Worker deployment configuration", () => {
  it.each(retiredCurriculumRedirects)(
    "sends %s through the Worker before static assets",
    async (pathname) => {
      const config = parseJsonc<WranglerConfig>(
        await readFile(`${repositoryRoot}/wrangler.jsonc`, "utf8"),
      );

      expect(resolveWorkerRoute(pathname)).toEqual({
        kind: "redirect",
        location: "/sessions/04-effects-and-events/",
      });
      expect(config.assets?.run_worker_first).toContain(pathname);
    },
  );

  it("runs Worker tests explicitly from the root test command used by CI", async () => {
    const rootPackage = JSON.parse(
      await readFile(`${repositoryRoot}/package.json`, "utf8"),
    ) as RootPackage;

    expect(rootPackage.scripts?.["test:worker"]).toBe(
      "pnpm --filter @fp-with-ts/docs exec vitest run ../../worker",
    );
    expect(rootPackage.scripts?.test).toContain("pnpm test:worker");
  });
});
