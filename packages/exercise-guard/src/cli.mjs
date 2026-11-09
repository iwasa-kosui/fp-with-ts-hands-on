#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { GuardConfigError } from "./config.mjs";
import { verify } from "./verify.mjs";

const usage = "使い方: exercise-guard [verify] [--root <dir>] [--timeout-ms <ミリ秒>] [--columns <桁数>]";
const defaultTimeoutMs = 120_000;
const terminateWaitMs = 2000;
const doneWaitMs = 1000;

/**
 * @param {readonly string[]} args
 * @param {string} flag
 * @returns {Readonly<{ rest: readonly string[], value: string | undefined | null }>}
 */
const takeFlag = (args, flag) => {
  const index = args.indexOf(flag);
  return index === -1
    ? { rest: args, value: undefined }
    : { rest: [...args.slice(0, index), ...args.slice(index + 2)], value: args[index + 1] ?? null };
};

/**
 * @param {string | number | undefined | null} value
 * @returns {number | undefined}
 */
const columnsFrom = (value) => {
  const columns = typeof value === "string" ? Number(value) : value;
  return typeof columns === "number" && Number.isInteger(columns) && columns > 0 ? columns : undefined;
};

/**
 * @param {readonly string[]} args
 * @returns {Readonly<{ command: "check" | "verify", root: string, timeoutMs: number, columns: number | undefined }> | undefined}
 */
export const parseArgs = (args) => {
  const { rest: withoutRoot, value: rootArg } = takeFlag(args, "--root");
  const { rest: withoutTimeout, value: timeoutArg } = takeFlag(withoutRoot, "--timeout-ms");
  const { rest, value: columnsArg } = takeFlag(withoutTimeout, "--columns");
  const [command, ...extra] = rest;
  const rootValue = rootArg === undefined ? process.cwd() : rootArg;
  const timeoutMs = timeoutArg === undefined ? defaultTimeoutMs : Number(timeoutArg);
  return rootValue === null ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs <= 0 ||
    extra.length > 0 ||
    (command !== undefined && command !== "verify")
    ? undefined
    : {
        command: command === "verify" ? "verify" : "check",
        root: path.resolve(rootValue),
        timeoutMs,
        columns: columnsFrom(columnsArg),
      };
};

/**
 * @param {number} pid
 * @returns {void}
 */
const killGroup = (pid) => {
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      return;
    }
  }
};

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
const writeOut = (text) =>
  new Promise((resolve) => {
    process.stdout.write(text, () => {
      resolve();
    });
  });

/**
 * @param {Readonly<{ root: string, timeoutMs: number, columns: number | undefined }>} input
 * @returns {Promise<number>}
 */
const runWatched = ({ root, timeoutMs, columns }) =>
  new Promise((resolve) => {
    const worker = new Worker(new URL("./judge-worker.mjs", import.meta.url), {
      workerData: {
        root,
        color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
        columns: columns ?? columnsFrom(process.stdout.columns),
      },
    });
    const vitestPids = new Set(/** @type {number[]} */ ([]));
    let doneCode = /** @type {number | undefined} */ (undefined);
    const stopVitest = () => {
      vitestPids.forEach(killGroup);
    };
    const exitNow = async (/** @type {number} */ code) => {
      await Promise.race([
        worker.terminate(),
        new Promise((wait) => {
          setTimeout(wait, terminateWaitMs);
        }),
      ]);
      process.exit(code);
    };
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let doneTimer = undefined;
    worker.on("message", (message) => {
      if (typeof message !== "object" || message === null || !("type" in message)) {
        return;
      }
      if (message.type === "vitest" && "pid" in message && typeof message.pid === "number") {
        vitestPids.add(message.pid);
      }
      if (message.type === "done" && "code" in message && typeof message.code === "number") {
        const code = message.code;
        doneCode = code;
        clearTimeout(timer);
        stopVitest();
        // WebContainer では止められない子プロセスが Worker を残すので、結果を書いた後は待たずに終わる。
        doneTimer = setTimeout(() => {
          void exitNow(code);
        }, doneWaitMs);
      }
    });
    const timer = setTimeout(async () => {
      await writeOut(
        `検出を検証する処理が ${Math.round(timeoutMs / 100) / 10} 秒で終わりませんでした。eslint.config.mjs のルールに、終わらない繰り返しがないか見直します。\n`,
      );
      stopVitest();
      await exitNow(124);
    }, timeoutMs);
    const interrupt = () => {
      clearTimeout(timer);
      stopVitest();
      void exitNow(130);
    };
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    worker.on("error", (error) => {
      clearTimeout(timer);
      stopVitest();
      process.stderr.write(`検出を検証する途中でエラーが出ました。\n${(error instanceof Error ? error.message : String(error)).split("\n")[0]}\n`);
      resolve(2);
    });
    worker.on("exit", () => {
      clearTimeout(timer);
      clearTimeout(doneTimer);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      resolve(doneCode ?? 1);
    });
  });

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
  if (parsed.command === "verify") {
    try {
      const { ok, lines } = await verify({ root: parsed.root });
      process.stdout.write(`${lines.join("\n")}\n`);
      return ok ? 0 : 1;
    } catch (error) {
      if (error instanceof GuardConfigError) {
        process.stderr.write(`演習の定義に誤りがあります。\n${error.messages.map((message) => `- ${message}`).join("\n")}\n`);
        return 2;
      }
      throw error;
    }
  }
  return runWatched({ root: parsed.root, timeoutMs: parsed.timeoutMs, columns: parsed.columns });
};

process.exitCode = await main(process.argv.slice(2));
