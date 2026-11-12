import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASELINE_COMMIT,
  BASELINE_FOLDERS,
  findDemoScriptProblems,
  findFileProblems,
  findReadmeProblems,
} from "./baseline-check.mjs";

const TAIL_LINES = 40;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");

const run = (command, args, { cwd, timeout }) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  const output = stripAnsi(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  return {
    status: result.status,
    output: result.error === undefined ? output : `${output}\n${result.error.message}`,
  };
};

const tail = (text) => text.trimEnd().split("\n").slice(-TAIL_LINES).join("\n");

const readBaselineFiles = (paths) => {
  if (paths.length === 0) return new Map();
  const result = spawnSync("git", ["cat-file", "--batch"], {
    cwd: rootDir,
    input: paths.map((path) => `${BASELINE_COMMIT}:${path}\n`).join(""),
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git cat-file に失敗しました\n${tail(String(result.stderr ?? ""))}`);
  }
  const output = result.stdout;
  const contents = new Map();
  let position = 0;
  for (const path of paths) {
    const lineEnd = output.indexOf(0x0a, position);
    const header = output.subarray(position, lineEnd).toString("utf8");
    const size = header.match(/^\S+ blob (\d+)$/);
    if (size === null) throw new Error(`基準 ${BASELINE_COMMIT} で読めません: ${path} (${header})`);
    const length = Number(size[1]);
    contents.set(path, output.subarray(lineEnd + 1, lineEnd + 1 + length).toString("utf8"));
    position = lineEnd + 1 + length + 1;
  }
  return contents;
};

const listBaselineFiles = (folder) => {
  const result = run("git", ["ls-tree", "-r", "--name-only", BASELINE_COMMIT, `examples/${folder}`], {
    cwd: rootDir,
    timeout: 60000,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-tree に失敗しました (基準 ${BASELINE_COMMIT}, ${folder})\n${tail(result.output)}`);
  }
  return result.output.split("\n").filter((file) => file !== "");
};

const baselineCheck = () => {
  const problems = [];
  try {
    const listed = run("git", ["ls-files", "-co", "--exclude-standard", "--", "examples"], {
      cwd: rootDir,
      timeout: 60000,
    });
    if (listed.status !== 0) {
      throw new Error(`git ls-files に失敗しました\n${tail(listed.output)}`);
    }
    const current = [...new Set(listed.output.split("\n").map((line) => line.trim()))].filter(
      (file) => file !== "" && existsSync(join(rootDir, file)),
    );
    const sources = [...new Set(BASELINE_FOLDERS.map(({ source }) => source))];
    const baseline = readBaselineFiles(sources.flatMap(listBaselineFiles));
    const readCurrent = (file) => readFileSync(join(rootDir, file), "utf8");
    problems.push(...findFileProblems({ current, readCurrent, baseline }));
    const folders = [...new Set(current.map((file) => file.split("/")[1]))];
    const readmes = new Map(
      folders
        .filter((folder) => folder.startsWith("session-") && current.includes(`examples/${folder}/README.md`))
        .map((folder) => [folder, readCurrent(`examples/${folder}/README.md`)]),
    );
    problems.push(...findReadmeProblems({ readmes, folders }));
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  const { scripts = {} } = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
  problems.push(...findDemoScriptProblems(scripts));
  return problems;
};

const displayWidth = (text) =>
  [...text].reduce((width, char) => {
    const code = char.codePointAt(0);
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6);
    return width + (wide ? 2 : 1);
  }, 0);

const pad = (text, width) => text + " ".repeat(Math.max(0, width - displayWidth(text)));

const printTable = (header, tableRows) => {
  const all = [header, ...tableRows];
  const widths = header.map((_, column) =>
    Math.max(...all.map((row) => displayWidth(row[column]))),
  );
  const line = (row) => row.map((cell, column) => pad(cell, widths[column])).join("  ");
  console.log(line(header));
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of tableRows) console.log(line(row));
};

const main = () => {
  const startedAt = Date.now();
  const rows = [];
  const failures = [];

  console.log("演習コードの基準差分を確認します");
  const problems = baselineCheck();
  rows.push([
    "基準差分",
    `${BASELINE_COMMIT} から examples（番号の振り直しを除く）と demo:*、README の番号が変わらない`,
    problems.length === 0 ? "変更なし" : `${problems.length}件の問題`,
    problems.length === 0 ? "OK" : "NG",
  ]);
  if (problems.length > 0) failures.push({ name: "基準差分", detail: problems.join("\n") });

  console.log("");
  printTable(["シナリオ", "期待", "実際", "判定"], rows);

  for (const failure of failures) {
    console.log(`\n=== 失敗: ${failure.name} ===\n${failure.detail}`);
  }

  const ng = rows.filter((row) => row[3] === "NG").length;
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n合計 ${rows.length} 件: OK ${rows.length - ng} / NG ${ng} (${seconds} 秒)`);
  process.exitCode = ng > 0 ? 1 : 0;
};

main();
