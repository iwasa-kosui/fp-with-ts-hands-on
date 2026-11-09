import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { groupGone } from "./process-group.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "src", "cli.mjs");
const s03 = path.join(here, "fixtures", "s03");
const hangRoot = path.join(here, "fixtures", "dist", "cli-lint-hangs");
const lingerRoot = path.join(here, "fixtures", "dist", "cli-worker-lingers");

/**
 * @param {number} rootPid
 * @returns {readonly number[]}
 */
const descendantGroups = (rootPid) => {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,pgid="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((columns) => columns.length === 3 && columns.every(Number.isFinite))
    .map(([pid = 0, ppid = 0, pgid = 0]) => ({ pid, ppid, pgid }));
  /** @param {ReadonlySet<number>} found @returns {ReadonlySet<number>} */
  const expand = (found) => {
    const next = new Set([...found, ...rows.filter((row) => found.has(row.ppid)).map((row) => row.pid)]);
    return next.size === found.size ? found : expand(next);
  };
  const family = expand(new Set([rootPid]));
  const ownGroup = rows.find((row) => row.pid === rootPid)?.pgid;
  return [...new Set(rows.filter((row) => family.has(row.pid) && row.pgid !== ownGroup).map((row) => row.pgid))];
};

/**
 * @param {string} cwd
 * @param {readonly string[]} args
 * @returns {Promise<Readonly<{ code: number | null, stdout: string, groups: readonly number[] }>>}
 */
const runCli = (cwd, args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = /** @type {string[]} */ ([]);
    child.stdout.on("data", (chunk) => chunks.push(String(chunk)));
    const groups = new Set(/** @type {number[]} */ ([]));
    const watcher = setInterval(() => {
      if (child.pid !== undefined) {
        descendantGroups(child.pid).forEach((group) => groups.add(group));
      }
    }, 300);
    child.on("close", (code) => {
      clearInterval(watcher);
      resolve({ code, stdout: chunks.join(""), groups: [...groups] });
    });
  });

afterAll(() => {
  rmSync(hangRoot, { recursive: true, force: true });
  rmSync(lingerRoot, { recursive: true, force: true });
});

describe("cli", () => {
  it("判定を worker で実行し、表と終了コードをそのまま返す", async () => {
    const result = await runCli(s03, ["--root", s03]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("結果: まだ合格していません");
  });

  it("lint-hangs: 終わらない規則は見張りで止め、プロセスを残さずに終わる", async () => {
    rmSync(hangRoot, { recursive: true, force: true });
    mkdirSync(path.dirname(hangRoot), { recursive: true });
    cpSync(s03, hangRoot, { recursive: true, filter: (source) => path.relative(s03, source).split(path.sep)[0] !== "dist" });
    cpSync(path.join(here, "fixtures", "s03-scenarios", "lint-hangs", "eslint.config.mjs"), path.join(hangRoot, "eslint.config.mjs"));
    mkdirSync(path.join(hangRoot, "exercises/guard/mine"), { recursive: true });
    writeFileSync(
      path.join(hangRoot, "exercises/guard/mine/hang.test.ts"),
      'import { it } from "vitest";\nimport { StartExaminationInput } from "../subjects/input.js";\n\nit("終わらない", () => {\n  void StartExaminationInput;\n  while (true) {}\n});\n',
    );

    const result = await runCli(hangRoot, ["--root", hangRoot, "--timeout-ms", "8000"]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain(
      "検出を確かめる処理が 8 秒で終わりませんでした。eslint.config.mjs の規則に、終わらない繰り返しがないか見直します。",
    );
    expect(result.groups.length).toBeGreaterThan(0);
    expect(await Promise.all(result.groups.map(groupGone))).toEqual(result.groups.map(() => true));
  });

  it("結果を出した後に worker が終わらなくても、待たずに終わり、result.json が残る", async () => {
    rmSync(lingerRoot, { recursive: true, force: true });
    mkdirSync(path.dirname(lingerRoot), { recursive: true });
    cpSync(s03, lingerRoot, { recursive: true, filter: (source) => path.relative(s03, source).split(path.sep)[0] !== "dist" });
    const config = readFileSync(path.join(lingerRoot, "eslint.config.mjs"), "utf8");
    writeFileSync(path.join(lingerRoot, "eslint.config.mjs"), `setInterval(() => {}, 1000);\n${config}`);

    const result = await runCli(lingerRoot, ["--root", lingerRoot, "--timeout-ms", "60000"]);

    expect(result.code).toBe(1);
    expect(result.stdout).toContain("結果: まだ合格していません");
    expect(existsSync(path.join(lingerRoot, "dist/guard/result.json"))).toBe(true);
  });
});
