import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  copyFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE_COMMIT = "088c2ef";
const EXERCISE_COMMANDS = ["01", "02", "03", "03-supplement", "04", "06"];

const RENAMED_FOLDERS = [
  { name: "session-01", source: "session-02", labels: { "02": "01", "01": "01" } },
  { name: "session-01-solution", source: "session-03", labels: { "03": "01" } },
  { name: "session-02", source: "session-02", labels: { "02": "02", "01": "02" } },
  { name: "session-02-solution", source: "session-03", labels: { "03": "02" } },
  { name: "session-03-supplement", source: "session-03", labels: { "03": "03" } },
  { name: "session-03-supplement-solution", source: "session-04", labels: { "04": "03", "03": "03" } },
  { name: "session-03", source: "session-04", labels: { "04": "03", "03": "03" } },
  { name: "session-03-solution", source: "session-05", labels: { "05": "03" } },
  { name: "session-04", source: "session-05", labels: { "05": "04", "04": "04" } },
  { name: "session-04-solution", source: "session-06", labels: { "06": "04" } },
  { name: "session-05", source: "session-01", labels: { "01": "05", "05": "05" } },
  { name: "session-06", source: "session-06", labels: { "06": "06" } },
  { name: "session-06-solution", source: "session-07", labels: { "07": "06" } },
];

const UNCHANGED_FOLDERS = ["session-00", "final", "fixtures", "start-examination-continuity"];

const SESSION_02_COPIES_FROM_SESSION_03 = [
  "src/domain/appointment/transitions.ts",
  "test/regression/compileTypeFixture.ts",
  "test/regression/type-fixtures/s2-paid-cannot-start.ts",
  "test/regression/type-fixtures/s2-cancel-requires-reason.ts",
  "test/regression/type-fixtures/s2-transition-sources.ts",
];

const ALLOWED_EXAMPLE_DIFFS = [
  "examples/session-00/README.md",
  ...RENAMED_FOLDERS.map(({ name }) => `examples/${name}/README.md`),
  "examples/final/README.md",
  "examples/session-03-solution/exercises/result-errors.test.ts",
  "examples/session-04/exercises/result-errors.test.ts",
  "examples/session-06-solution/src/useCase/startExamination.ts",
  "examples/session-06-solution/src/useCase/dependencies.ts",
  "examples/session-06-solution/src/web/routes.ts",
  "examples/session-06-solution/test/in-memory-store.test.ts",
  "examples/session-06-solution/test/integration/fileSqliteTransaction.test.ts",
  "examples/session-06-solution/test/regression/effects-and-events.test.ts",
  "examples/session-04-solution/exercises/effects-and-events.test.ts",
  "examples/session-06/exercises/effects-and-events.test.ts",
  "examples/session-02/test/transitions.test.ts",
  "examples/session-02/test/regression/state-modeling.test.ts",
  "examples/session-02/src/domain/appointment/index.ts",
  "examples/session-02/test/regression/type-fixtures/s2-payment-requires-completed-examination.ts",
  ...SESSION_02_COPIES_FROM_SESSION_03.map((file) => `examples/session-02/${file}`),
  "examples/final/src/useCase/startExaminationUseCase.ts",
  "examples/final/src/useCase/bookAppointmentUseCase.ts",
  "examples/final/src/useCase/cancelAppointmentUseCase.ts",
  "examples/final/src/useCase/checkInAppointmentUseCase.ts",
  "examples/final/src/useCase/createOwnerUseCase.ts",
  "examples/final/src/useCase/createPetUseCase.ts",
  "examples/final/src/useCase/createUserUseCase.ts",
  "examples/final/src/useCase/deleteOwnerUseCase.ts",
  "examples/final/src/useCase/deletePetUseCase.ts",
  "examples/final/src/useCase/deleteUserUseCase.ts",
  "examples/final/src/useCase/logOutUseCase.ts",
  "examples/final/src/useCase/recordPaymentUseCase.ts",
  "examples/final/src/useCase/updateOwnerUseCase.ts",
  "examples/final/src/useCase/updatePetUseCase.ts",
  "examples/final/src/useCase/updateUserUseCase.ts",
  "examples/final/src/useCase/resetUserPasswordUseCase.ts",
  "examples/final/src/useCase/logInUseCase.ts",
  "examples/final/src/useCase/recordExamResultUseCase.ts",
  "examples/final/src/useCase/requestFollowUpUseCase.ts",
  "examples/final/src/useCase/setUpInitialAdminUseCase.ts",
  "examples/final/src/useCase/listFollowUpsUseCase.ts",
  "examples/final/src/useCase/rejectExamResultPetMismatch.ts",
  "examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts",
  "examples/final/src/adaptor/primary/web/routes/authRoutes.ts",
  "examples/final/src/adaptor/primary/web/routes/followUpRoutes.ts",
  "examples/final/src/adaptor/primary/web/routes/ownerRoutes.ts",
  "examples/final/src/adaptor/primary/web/routes/petRoutes.ts",
  "examples/final/src/adaptor/primary/web/routes/userRoutes.ts",
  "examples/final/src/domain/appointment/appointment.ts",
  "examples/final/src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts",
  "examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
  "examples/final/test/adaptor/sqliteEventStore.test.ts",
  "examples/final/test/domain/appointment.test.ts",
  "examples/final/test/useCase/appointmentUseCases.test.ts",
  "examples/final/test/useCase/authenticationUseCases.test.ts",
  "examples/final/test/useCase/followUpUseCases.test.ts",
  "examples/final/test/useCase/ownerPetUseCases.test.ts",
  "examples/final/test/useCase/startExaminationUseCase.test.ts",
  "examples/final/test/web/authRoutes.test.ts",
  "examples/start-examination-continuity/test/snapshotScenario.ts",
  "examples/start-examination-continuity/test/resetAtomicity.test.ts",
  "examples/start-examination-continuity/test/session00To05.test.ts",
  "examples/start-examination-continuity/test/session06To07.test.ts",
  "examples/start-examination-continuity/test/session00To04.test.ts",
  "examples/start-examination-continuity/test/session06.test.ts",
];

const STEP_1_TO_3_FILES = ["src/domain/appointment/transitions.ts"];

const S4_PAGE = "apps/docs/src/pages/sessions/04-workflow-errors.astro";

const S4_PAGE_SOLUTION = {
  page: S4_PAGE,
  wholeFiles: [
    {
      target: "src/useCase/errors.ts",
      path: "examples/session-04-solution/src/useCase/errors.ts",
      lines: [1, 31],
    },
    {
      target: "src/useCase/startExamination.ts",
      path: "examples/session-04-solution/src/useCase/startExamination.ts",
      lines: [7, 44],
    },
  ],
  routes: {
    target: "src/web/routes.ts",
    handler: {
      path: "examples/session-04/src/web/routes.ts",
      sourcePath: "apps/docs/src/sessions/solutions/session-04-start-examination-handler.ts.txt",
      lines: [1, 22],
      replaceLines: [73, 94],
    },
    insert: {
      path: "examples/session-04-solution/src/web/routes.ts",
      lines: [22, 48],
    },
  },
};

const SCENARIOS = [
  { session: "01", name: "S01 開始", before: 5, overlay: null, after: null },
  {
    session: "01",
    name: "S01 Step 1-3",
    before: 5,
    overlay: { from: "examples/session-01-solution", files: STEP_1_TO_3_FILES },
    after: 1,
  },
  {
    session: "01",
    name: "S01 全解答",
    before: 5,
    overlay: {
      from: "examples/session-01-solution",
      files: [
        "src/domain/appointment/transitions.ts",
        "src/domain/appointment/statusLabel.ts",
      ],
    },
    after: 0,
  },
  { session: "02", name: "S02 開始", before: 1, overlay: null, after: null },
  {
    session: "02",
    name: "S02 全解答",
    before: 1,
    overlay: {
      from: "examples/session-02-solution",
      files: ["src/domain/appointment/statusLabel.ts"],
    },
    after: 0,
  },
  { session: "03-supplement", name: "S03 補助演習 開始", before: 3, overlay: null, after: null },
  {
    session: "03-supplement",
    name: "S03 補助演習 全解答",
    before: 3,
    overlay: {
      from: "examples/session-03-supplement-solution",
      files: [
        "src/domain/appointment/appointmentId.ts",
        "src/domain/appointment/veterinarianId.ts",
        "src/domain/appointment/appointment.ts",
        "src/domain/appointment/transitions.ts",
        "src/domain/domain.test-types.ts",
      ],
    },
    after: 0,
  },
  { session: "03", name: "S03 開始", before: 2, overlay: null, after: null },
  {
    session: "03",
    name: "S03 全解答",
    before: 2,
    overlay: {
      from: "examples/session-03-solution",
      files: ["src/boundary/startExaminationInput.ts"],
    },
    after: 0,
  },
  { session: "04", name: "S04 開始", before: 8, overlay: null, after: null },
  {
    session: "04",
    name: "S04 回帰（session-04-solution）",
    before: 8,
    overlay: {
      regression: {
        session: "04-solution",
        testFile: "test/regression/result-errors.test.ts",
      },
    },
    after: 0,
  },
  {
    session: "04",
    name: "S04 解答（ページの解答）",
    before: 8,
    overlay: { pageSolution: S4_PAGE_SOLUTION },
    after: 0,
  },
  { session: "06", name: "S06 開始", before: 4, overlay: null, after: null },
  {
    session: "06",
    name: "S06 全解答",
    before: 4,
    overlay: {
      from: "examples/session-06-solution",
      files: [
        "src/useCase/dependencies.ts",
        "src/useCase/startExamination.ts",
        "src/useCase/errors.ts",
      ],
    },
    after: 0,
  },
];

const TAIL_LINES = 40;
const INSTALL_TIMEOUT_MS = 600000;
const EXERCISE_TIMEOUT_MS = 300000;

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const usage = "使い方: node scripts/verify-exercises.mjs [--only 02,03-supplement] [--keep]";

const parseArgs = (argv) => {
  const options = { only: null, keep: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--keep") options.keep = true;
    else if (arg === "--only" || arg.startsWith("--only=")) {
      const value = arg === "--only" ? argv[(index += 1)] : arg.slice("--only=".length);
      if (value === undefined || value === "") {
        console.error(`--only に番号を指定してください。\n${usage}`);
        process.exit(2);
      }
      options.only = value.split(",").map((item) => item.trim().padStart(2, "0"));
    } else {
      console.error(`不明な引数です: ${arg}\n${usage}`);
      process.exit(2);
    }
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));

const knownSessions = [...new Set(SCENARIOS.map((scenario) => scenario.session))];
if (options.only !== null) {
  const unknown = options.only.filter((item) => !knownSessions.includes(item));
  if (unknown.length > 0) {
    console.error(
      `--only に未対応の番号があります: ${unknown.join(",")}\n対応する番号: ${knownSessions.join(",")}`,
    );
    process.exit(2);
  }
}

const selectedScenarios = SCENARIOS.filter(
  (scenario) => options.only === null || options.only.includes(scenario.session),
);

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

const listSourceFiles = () => {
  const result = run("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
    cwd: rootDir,
    timeout: 60000,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files に失敗しました\n${tail(result.output)}`);
  }
  return [...new Set(result.output.split("\0").filter((file) => file !== ""))];
};

const copyEntry = (relativePath, destinationRoot) => {
  const source = join(rootDir, relativePath);
  let stat;
  try {
    stat = lstatSync(source);
  } catch {
    return false;
  }
  if (stat.isDirectory()) return false;
  const destination = join(destinationRoot, relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  if (stat.isSymbolicLink()) symlinkSync(readlinkSync(source), destination);
  else copyFileSync(source, destination);
  return true;
};

const countFailures = (output) => {
  const typeRequirements = output
    .split("\n")
    .filter((line) => /^\S.*:\d+ - 要件未達:/.test(line)).length;
  const typeDiagnostics = output
    .split("\n")
    .filter((line) => /^\S.*\(\d+,\d+\): error TS\d+:/.test(line)).length;
  const failedTests = output.match(/^\s*Tests\s+(\d+) failed/m);
  return typeRequirements + typeDiagnostics + (failedTests === null ? 0 : Number(failedTests[1]));
};

const countPassed = (output) => {
  const line = output.match(/^\s*Tests\s+(.*)$/m);
  const passed = line === null ? null : line[1].match(/(\d+) passed/);
  return passed === null ? 0 : Number(passed[1]);
};

const execute = (workDir, args) => {
  const result = run("pnpm", args, { cwd: workDir, timeout: EXERCISE_TIMEOUT_MS });
  const count = countFailures(result.output);
  const passed = countPassed(result.output);
  const noProjects = result.output.includes("No projects matched");
  const readable = !noProjects && (count > 0 || result.status === 0);
  return { ...result, count, passed, readable };
};

const runRegression = (workDir, { session, testFile }) =>
  execute(workDir, [
    "--filter",
    `@fp-with-ts/clinic-session-${session}`,
    "exec",
    "vitest",
    "run",
    testFile,
  ]);

const runExercise = (workDir, session) => execute(workDir, [`exercise:${session}`]);

const describeRun = (outcome) =>
  outcome.readable
    ? `${outcome.count}件/exit ${outcome.status}${outcome.count === 0 && outcome.passed === 0 ? "/成功テストなし" : ""}`
    : `件数を読めない/exit ${outcome.status}`;

const matches = (outcome, expected) =>
  outcome.status !== null &&
  outcome.readable &&
  outcome.count === expected &&
  (outcome.status === 0) === (expected === 0) &&
  (expected !== 0 || outcome.passed > 0);

const describeExpected = (expected) => `${expected}件/exit ${expected === 0 ? "0" : "≠0"}`;

const resetSession = (workDir, session, sourceFiles) => {
  const sessionDir = join(workDir, "examples", `session-${session}`);
  for (const entry of readdirSync(sessionDir)) {
    if (entry === "node_modules") continue;
    rmSync(join(sessionDir, entry), { recursive: true, force: true });
  }
  const prefix = `examples/session-${session}/`;
  for (const file of sourceFiles) {
    if (file.startsWith(prefix)) copyEntry(file, workDir);
  }
};

const applyOverlay = (workDir, session, overlay) => {
  const target = join(workDir, "examples", `session-${session}`);
  if (overlay.replaceDir !== undefined) {
    const from = join(workDir, overlay.from, overlay.replaceDir);
    const to = join(target, overlay.replaceDir);
    if (!existsSync(from)) throw new Error(`置換元が見つかりません: ${from}`);
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true });
    return;
  }
  for (const file of overlay.files) {
    const from = join(workDir, overlay.from, file);
    if (!existsSync(from)) throw new Error(`重ねるファイルが見つかりません: ${from}`);
    const to = join(target, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
};

const readLines = (workDir, relativePath, [start, end]) => {
  const path = join(workDir, relativePath);
  if (!existsSync(path)) throw new Error(`解答の元ファイルが見つかりません: ${relativePath}`);
  const lines = readFileSync(path, "utf8").split("\n");
  if (end > lines.length) {
    throw new Error(`指定行がソースの範囲外です: ${relativePath}:${start}-${end}`);
  }
  return lines.slice(start - 1, end);
};

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertPageDeclares = (workDir, solution) => {
  const pagePath = join(workDir, solution.page);
  if (!existsSync(pagePath)) throw new Error(`ページが見つかりません: ${solution.page}`);
  const page = readFileSync(pagePath, "utf8");
  const { handler, insert } = solution.routes;
  const declared = [
    ...solution.wholeFiles,
    { path: handler.path, sourcePath: handler.sourcePath, lines: handler.lines },
    { path: insert.path, lines: insert.lines },
  ];
  for (const { path, sourcePath, lines } of declared) {
    const [start, end] = lines;
    const pattern = new RegExp(
      `path: "${escapeRegExp(path)}",[^}]*?lines: \\[${start}, ${end}\\]`,
    );
    if (!pattern.test(page)) {
      throw new Error(`ページの宣言と検証がずれています: ${path} lines: [${start}, ${end}]`);
    }
    if (sourcePath !== undefined && !page.includes(`"${sourcePath}"`)) {
      throw new Error(`ページの宣言と検証がずれています: ${sourcePath}`);
    }
  }
};

const applyPageSolution = (workDir, session, solution) => {
  const target = join(workDir, "examples", `session-${session}`);
  const { routes } = solution;
  const routesPath = join(target, routes.target);
  const routeLines = readFileSync(routesPath, "utf8").split("\n");
  const [replaceStart, replaceEnd] = routes.handler.replaceLines;
  const handlerRange = routeLines.slice(replaceStart - 1, replaceEnd);
  if (!(handlerRange[0] ?? "").trimStart().startsWith("app.post(")) {
    throw new Error(
      `${routes.target}:${replaceStart} が app.post( で始まりません: ${handlerRange[0] ?? "(なし)"}`,
    );
  }
  if (!handlerRange.some((line) => line.includes("try {"))) {
    throw new Error(`${routes.target}:${replaceStart}-${replaceEnd} に try { がありません`);
  }
  assertPageDeclares(workDir, solution);

  for (const { target: file, path, lines } of solution.wholeFiles) {
    writeFileSync(join(target, file), `${readLines(workDir, path, lines).join("\n")}\n`);
  }

  const handler = readLines(workDir, routes.handler.sourcePath, routes.handler.lines);
  const replaced = [
    ...routeLines.slice(0, replaceStart - 1),
    ...handler,
    ...routeLines.slice(replaceEnd),
  ];
  const importEnd = replaced.reduce(
    (last, line, index) => (/^(import .*|\} from .*);$/.test(line) ? index : last),
    -1,
  );
  if (importEnd < 0) throw new Error(`${routes.target} に import が見つかりません`);
  const inserted = readLines(workDir, routes.insert.path, routes.insert.lines);
  writeFileSync(
    routesPath,
    [...replaced.slice(0, importEnd + 1), ...inserted, ...replaced.slice(importEnd + 1)].join("\n"),
  );
};

const runScenario = (workDir, scenario, sourceFiles) => {
  const { session, overlay } = scenario;
  const phases = [];
  try {
    const start = runExercise(workDir, session);
    phases.push({ label: "開始", expected: scenario.before, outcome: start });
    if (overlay !== null) {
      if (overlay.pageSolution !== undefined) {
        applyPageSolution(workDir, session, overlay.pageSolution);
      } else if (overlay.regression === undefined) {
        applyOverlay(workDir, session, overlay);
      }
      const solved =
        overlay.regression === undefined
          ? runExercise(workDir, session)
          : runRegression(workDir, overlay.regression);
      phases.push({ label: "解答後", expected: scenario.after, outcome: solved });
    }
  } finally {
    resetSession(workDir, session, sourceFiles);
  }
  return phases;
};

const camelCaseFolder = (suffix) =>
  `session${suffix
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join("")}`;

const renameIdentifiers = (text, { name, source, labels }) => {
  const from = source.slice("session-".length);
  const to = name.slice("session-".length);
  return text
    .replace(new RegExp(`clinic-session-${from}(?!\\d)`, "g"), `clinic-session-${to}`)
    .replace(new RegExp(`(?<![\\w-])session-${from}(?!\\d)`, "g"), `session-${to}`)
    .replace(
      new RegExp(`(?<![A-Za-z0-9])session${from}(?=[A-Z])`, "g"),
      camelCaseFolder(to),
    )
    .replace(/Session (\d\d)/g, (match, number) =>
      labels[number] === undefined ? match : `Session ${labels[number]}`,
    )
    .replace(new RegExp(`exercise:${from}(?!\\d)`, "g"), `exercise:${to}`)
    .replace(new RegExp(`demo:${from}(?!\\d)`, "g"), `demo:${to}`);
};

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

const compareFolder = (current, folder, problems) => {
  const { name, source } = folder;
  const baselineFiles = listBaselineFiles(source);
  const baseline = readBaselineFiles(baselineFiles);
  const rename = (text) => (folder.labels === undefined ? text : renameIdentifiers(text, folder));
  const expected = new Map(
    baselineFiles.map((file) => [
      `examples/${name}/${file.slice(`examples/${source}/`.length)}`,
      rename(baseline.get(file)),
    ]),
  );
  const actualFiles = current.filter((file) => file.startsWith(`examples/${name}/`));
  const differing = [];
  for (const file of new Set([...expected.keys(), ...actualFiles])) {
    const actual = actualFiles.includes(file) ? readFileSync(join(rootDir, file), "utf8") : null;
    if (actual !== (expected.get(file) ?? null)) differing.push(file);
  }
  for (const file of differing) {
    if (!ALLOWED_EXAMPLE_DIFFS.includes(file)) {
      problems.push(`基準 ${BASELINE_COMMIT} の examples/${source} から変わったファイル: ${file}`);
    }
  }
};

const compareSession02Copies = (current, problems) => {
  const solution = RENAMED_FOLDERS.find(({ name }) => name === "session-02-solution");
  const files = SESSION_02_COPIES_FROM_SESSION_03.map((file) => `examples/session-03/${file}`);
  const baseline = readBaselineFiles(files);
  for (const file of SESSION_02_COPIES_FROM_SESSION_03) {
    const path = `examples/session-02/${file}`;
    const expected = renameIdentifiers(baseline.get(`examples/session-03/${file}`), {
      ...solution,
      name: "session-02",
    });
    if (!current.includes(path) || readFileSync(join(rootDir, path), "utf8") !== expected) {
      problems.push(`${path} が基準 ${BASELINE_COMMIT} の examples/session-03/${file} の写しではありません`);
    }
  }
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

    const folders = [
      ...RENAMED_FOLDERS,
      ...UNCHANGED_FOLDERS.map((name) => ({ name, source: name })),
    ];
    const unknown = current.filter(
      (file) => !folders.some(({ name }) => file.startsWith(`examples/${name}/`)),
    );
    if (unknown.length > 0) {
      problems.push(`対応表にないフォルダのファイル:\n${unknown.map((file) => `  ${file}`).join("\n")}`);
    }
    for (const folder of folders) compareFolder(current, folder, problems);
    compareSession02Copies(current, problems);
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error));
  }

  const actual = Object.fromEntries(
    Object.entries(JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")).scripts ?? {}).filter(
      ([name]) => name.startsWith("exercise:"),
    ),
  );
  const expected = Object.fromEntries(
    EXERCISE_COMMANDS.map((number) => [
      `exercise:${number}`,
      `pnpm --filter @fp-with-ts/clinic-session-${number} exercise`,
    ]),
  );
  for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    if (expected[name] !== actual[name]) {
      problems.push(
        `package.json の ${name} が想定と違います\n  想定: ${expected[name] ?? "(なし)"}\n  現在: ${actual[name] ?? "(なし)"}`,
      );
    }
  }
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
    `${BASELINE_COMMIT} から examples（番号の振り直しを除く）と exercise:* が変わらない`,
    problems.length === 0 ? "変更なし" : `${problems.length}件の問題`,
    problems.length === 0 ? "OK" : "NG",
  ]);
  if (problems.length > 0) failures.push({ name: "基準差分", detail: problems.join("\n") });

  const workDir = mkdtempSync(join(tmpdir(), "verify-exercises-"));
  const cleanup = () => {
    if (options.keep) console.log(`\n一時ディレクトリを残しました: ${workDir}`);
    else rmSync(workDir, { recursive: true, force: true });
  };
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  try {
    console.log(`一時コピーを作ります: ${workDir}`);
    const sourceFiles = listSourceFiles();
    const copied = sourceFiles.filter((file) => copyEntry(file, workDir)).length;
    console.log(`${copied} ファイルをコピーしました`);

    console.log("pnpm install --frozen-lockfile を実行します");
    const install = run("pnpm", ["install", "--frozen-lockfile"], {
      cwd: workDir,
      timeout: INSTALL_TIMEOUT_MS,
    });
    if (install.status !== 0) {
      throw new Error(`pnpm install --frozen-lockfile に失敗しました\n${tail(install.output)}`);
    }

    for (const scenario of selectedScenarios) {
      console.log(`${scenario.name} を実行します`);
      const phases = runScenario(workDir, scenario, sourceFiles);
      const ok = phases.every((phase) => matches(phase.outcome, phase.expected));
      rows.push([
        scenario.name,
        phases.map((phase) => `${phase.label} ${describeExpected(phase.expected)}`).join(" -> "),
        phases.map((phase) => `${phase.label} ${describeRun(phase.outcome)}`).join(" -> "),
        ok ? "OK" : "NG",
      ]);
      if (!ok) {
        const detail = phases
          .filter((phase) => !matches(phase.outcome, phase.expected))
          .map((phase) => `[${phase.label}] 出力の末尾\n${tail(phase.outcome.output)}`)
          .join("\n\n");
        failures.push({ name: scenario.name, detail });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    rows.push(["実行環境", "一時コピーでの実行", "失敗", "NG"]);
    failures.push({ name: "実行環境", detail: message });
  } finally {
    cleanup();
  }

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
