import { parentPort, workerData } from "node:worker_threads";
import { GuardConfigError } from "./config.mjs";
import { judge } from "./judge.mjs";
import { render } from "./render.mjs";

/**
 * @param {string} root
 * @param {boolean} color
 * @returns {Promise<number>}
 */
const main = async (root, color) => {
  try {
    const result = await judge({
      root,
      onVitestSpawn: (pid) => {
        parentPort?.postMessage({ type: "vitest", pid });
      },
    });
    process.stdout.write(render(result, { color }));
    return result.passed ? 0 : 1;
  } catch (error) {
    if (error instanceof GuardConfigError) {
      process.stderr.write(`演習の定義に誤りがあります。\n${error.messages.map((message) => `- ${message}`).join("\n")}\n`);
      return 2;
    }
    throw error;
  }
};

parentPort?.postMessage({ type: "done", code: await main(String(workerData.root), workerData.color === true) });
