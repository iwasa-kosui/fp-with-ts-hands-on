#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { GuardConfigError } from "./config.mjs";
import { judge } from "./judge.mjs";
import { render } from "./render.mjs";
import { verify } from "./verify.mjs";

const usage = "使い方: exercise-guard [verify] [--root <dir>]";

/**
 * @param {readonly string[]} args
 * @returns {Readonly<{ command: "check" | "verify", root: string }> | undefined}
 */
export const parseArgs = (args) => {
  const rootIndex = args.indexOf("--root");
  const rest = rootIndex === -1 ? args : [...args.slice(0, rootIndex), ...args.slice(rootIndex + 2)];
  const rootValue = rootIndex === -1 ? process.cwd() : args[rootIndex + 1];
  const [command, ...extra] = rest;
  return rootValue === undefined ||
    extra.length > 0 ||
    (command !== undefined && command !== "verify")
    ? undefined
    : { command: command === "verify" ? "verify" : "check", root: path.resolve(rootValue) };
};

/**
 * @param {readonly string[]} args
 * @returns {Promise<number>}
 */
export const main = async (args) => {
  const parsed = parseArgs(args);
  if (parsed === undefined) {
    process.stderr.write(`${usage}\n`);
    return 2;
  }
  if (!existsSync(parsed.root)) {
    process.stderr.write(`--root のディレクトリがありません: ${parsed.root}\n`);
    return 2;
  }
  process.chdir(parsed.root);
  try {
    if (parsed.command === "verify") {
      const { ok, lines } = await verify({ root: parsed.root });
      process.stdout.write(`${lines.join("\n")}\n`);
      return ok ? 0 : 1;
    }
    const result = await judge({ root: parsed.root });
    process.stdout.write(
      render(result, { color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR }),
    );
    return result.passed ? 0 : 1;
  } catch (error) {
    if (error instanceof GuardConfigError) {
      process.stderr.write(`演習の定義に誤りがあります。\n${error.messages.map((message) => `- ${message}`).join("\n")}\n`);
      return 2;
    }
    throw error;
  }
};

process.exitCode = await main(process.argv.slice(2));
