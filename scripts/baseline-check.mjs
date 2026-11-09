export const BASELINE_COMMIT = "088c2ef";
export const EXERCISE_COMMANDS = ["01", "02", "03", "03-supplement", "04", "06"];

export const RENAMED_FOLDERS = [
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

export const UNCHANGED_FOLDERS = ["session-00", "final", "fixtures", "start-examination-continuity"];

export const FIXTURE_FILE_RENAMES = {
  "s2-paid-cannot-start.ts": "paid-cannot-start.ts",
  "s2-cancel-requires-reason.ts": "cancel-requires-reason.ts",
  "s2-payment-requires-completed-examination.ts": "payment-requires-completed-examination.ts",
  "s2-status-exhaustive.ts": "status-exhaustive.ts",
  "s2-transition-sources.ts": "transition-sources.ts",
  "s3-appointment-id-is-not-veterinarian-id.ts": "appointment-id-is-not-veterinarian-id.ts",
  "s3-start-examination-requires-typed-ids.ts": "start-examination-requires-typed-ids.ts",
  "s4-exam-result-readonly.ts": "exam-result-readonly.ts",
};

const FIXTURE_PATH = /(\/type-fixtures\/)([^/]+)$/;

export const renameFixturePath = (path) =>
  path.replace(FIXTURE_PATH, (match, directory, base) => `${directory}${FIXTURE_FILE_RENAMES[base] ?? base}`);

export const baselineFixturePath = (path) =>
  path.replace(FIXTURE_PATH, (match, directory, base) => {
    const original = Object.keys(FIXTURE_FILE_RENAMES).find((key) => FIXTURE_FILE_RENAMES[key] === base);
    return `${directory}${original ?? base}`;
  });

export const REGRESSION_LABELS = { 2: "S01", 3: "S03 補助演習", 4: "S03", 5: "S04" };

export const SESSION_02_COPIES_FROM_SESSION_03 = [
  "src/domain/appointment/transitions.ts",
  "test/regression/compileTypeFixture.ts",
  "test/regression/type-fixtures/paid-cannot-start.ts",
  "test/regression/type-fixtures/cancel-requires-reason.ts",
  "test/regression/type-fixtures/transition-sources.ts",
];

export const ALLOWED_EXAMPLE_DIFFS = [
  "examples/session-00/README.md",
  ...RENAMED_FOLDERS.map(({ name }) => `examples/${name}/README.md`),
  "examples/final/README.md",
  "examples/session-01-solution/package.json",
  "examples/session-01-solution/eslint.config.mjs",
  "examples/session-01-solution/exercises/guard/answer/eslint.config.mjs",
  "examples/session-01-solution/exercises/guard/answer/mine/callers.test.ts",
  "examples/session-01-solution/exercises/guard/answer/mine/states.ts",
  "examples/session-01-solution/exercises/guard/answer/mine/transitions.test.ts",
  "examples/session-01-solution/exercises/guard/answer/mine/transitions.type-test.ts",
  "examples/session-01-solution/exercises/guard/cases/B1-cast-start-examination.ts",
  "examples/session-01-solution/exercises/guard/cases/B2-widened-start-examination.ts",
  "examples/session-01-solution/exercises/guard/cases/B3-cancel-keeps-visit-reason.ts",
  "examples/session-01-solution/exercises/guard/cases/B4-cast-via-unknown.ts",
  "examples/session-01-solution/exercises/guard/cases/B5-start-time-from-check-in.ts",
  "examples/session-01-solution/exercises/guard/cases/G1-transitions.ts",
  "examples/session-01-solution/exercises/guard/cases/G2-callers-check-state.ts",
  "examples/session-01-solution/exercises/guard/cases/G3-global-this-cast.ts",
  "examples/session-01-solution/exercises/guard/cases/R1-peer-change.ts",
  "examples/session-01-solution/exercises/guard/guard.config.mjs",
  "examples/session-01-solution/exercises/guard/mine/callers.test.ts",
  "examples/session-01-solution/exercises/guard/mine/states.ts",
  "examples/session-01-solution/exercises/guard/mine/transitions.test.ts",
  "examples/session-01-solution/exercises/guard/mine/transitions.type-test.ts",
  "examples/session-01-solution/exercises/guard/subjects/callers.ts",
  "examples/session-01-solution/exercises/guard/subjects/lifecycle.ts",
  "examples/session-01-solution/exercises/guard/subjects/transitions.ts",
  "examples/session-03-solution/exercises/result-errors.test.ts",
  "examples/session-03-solution/package.json",
  "examples/session-03-solution/eslint.config.mjs",
  "examples/session-03-solution/src/adaptor/secondary/sqlite/appointmentRepository.ts",
  "examples/session-03-solution/src/adaptor/secondary/sqlite/auditPayload.ts",
  "examples/session-03-solution/exercises/guard/answer/eslint.config.mjs",
  "examples/session-03-solution/exercises/guard/answer/mine/audit.test.ts",
  "examples/session-03-solution/exercises/guard/answer/mine/audit.type-test.ts",
  "examples/session-03-solution/exercises/guard/answer/mine/handler.test.ts",
  "examples/session-03-solution/exercises/guard/answer/mine/ids.type-test.ts",
  "examples/session-03-solution/exercises/guard/answer/mine/input.test.ts",
  "examples/session-03-solution/exercises/guard/cases/B1-any-parser.ts",
  "examples/session-03-solution/exercises/guard/cases/B2-unknown-cast.ts",
  "examples/session-03-solution/exercises/guard/cases/B3-schema-without-uuid.ts",
  "examples/session-03-solution/exercises/guard/cases/B4-audit-owner-contact.ts",
  "examples/session-03-solution/exercises/guard/cases/B5-handler-bypasses-parse.ts",
  "examples/session-03-solution/exercises/guard/cases/B6-swapped-ids.ts",
  "examples/session-03-solution/exercises/guard/cases/G1-solution.ts",
  "examples/session-03-solution/exercises/guard/cases/G2-handler-uses-parse.ts",
  "examples/session-03-solution/exercises/guard/cases/G3-as-const.ts",
  "examples/session-03-solution/exercises/guard/cases/G4-audit-three-fields.ts",
  "examples/session-03-solution/exercises/guard/cases/R1-peer-change.ts",
  "examples/session-03-solution/exercises/guard/guard.config.mjs",
  "examples/session-03-solution/exercises/guard/mine/audit.test.ts",
  "examples/session-03-solution/exercises/guard/mine/audit.type-test.ts",
  "examples/session-03-solution/exercises/guard/mine/handler.test.ts",
  "examples/session-03-solution/exercises/guard/mine/ids.type-test.ts",
  "examples/session-03-solution/exercises/guard/mine/input.test.ts",
  "examples/session-03-solution/exercises/guard/subjects/audit.ts",
  "examples/session-03-solution/exercises/guard/subjects/handler.ts",
  "examples/session-03-solution/exercises/guard/subjects/input.ts",
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
  "examples/session-02/test/regression/type-fixtures/payment-requires-completed-examination.ts",
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

export const camelCaseFolder = (suffix) =>
  `session${suffix
    .split("-")
    .map((part, index) => (index === 0 ? part : `${part[0].toUpperCase()}${part.slice(1)}`))
    .join("")}`;

export const renameIdentifiers = (text, { name, source, labels }) => {
  const from = source.slice("session-".length);
  const to = name.slice("session-".length);
  const renamed = Object.entries(FIXTURE_FILE_RENAMES).reduce(
    (current, [before, after]) => current.replaceAll(before, after),
    text,
  );
  return renamed
    .replace(new RegExp(`clinic-session-${from}(?!\\d)`, "g"), `clinic-session-${to}`)
    .replace(new RegExp(`(?<![\\w-])session-${from}(?!\\d)`, "g"), `session-${to}`)
    .replace(
      new RegExp(`(?<![A-Za-z0-9])session${from}(?=[A-Z])`, "g"),
      camelCaseFolder(to),
    )
    .replace(/Session (\d\d)/g, (match, number) =>
      labels[number] === undefined ? match : `Session ${labels[number]}`,
    )
    .replace(/(?<![A-Za-z0-9])S([2-5])((?: Step [0-9])? regression)/g, (match, number, rest) =>
      `${REGRESSION_LABELS[number]}${rest}`,
    )
    .replace(new RegExp(`exercise:${from}(?!\\d)`, "g"), `exercise:${to}`)
    .replace(new RegExp(`demo:${from}(?!\\d)`, "g"), `demo:${to}`);
};

export const BASELINE_FOLDERS = [
  ...RENAMED_FOLDERS,
  ...UNCHANGED_FOLDERS.map((name) => ({ name, source: name })),
];

const compareFolder = ({ current, readCurrent, baseline }, folder, problems) => {
  const { name, source } = folder;
  const sourcePrefix = `examples/${source}/`;
  const rename = (text) => (folder.labels === undefined ? text : renameIdentifiers(text, folder));
  const expected = new Map(
    [...baseline.keys()]
      .filter((file) => file.startsWith(sourcePrefix))
      .map((file) => [
        `examples/${name}/${renameFixturePath(file.slice(sourcePrefix.length))}`,
        rename(baseline.get(file)),
      ]),
  );
  const actualFiles = current.filter((file) => file.startsWith(`examples/${name}/`));
  const differing = [];
  for (const file of new Set([...expected.keys(), ...actualFiles])) {
    const actual = actualFiles.includes(file) ? readCurrent(file) : null;
    if (actual !== (expected.get(file) ?? null)) differing.push(file);
  }
  for (const file of differing) {
    if (!ALLOWED_EXAMPLE_DIFFS.includes(file)) {
      problems.push(`基準 ${BASELINE_COMMIT} の examples/${source} から変わったファイル: ${file}`);
    }
  }
};

const compareSession02Copies = ({ current, readCurrent, baseline }, problems) => {
  const solution = RENAMED_FOLDERS.find(({ name }) => name === "session-02-solution");
  for (const file of SESSION_02_COPIES_FROM_SESSION_03) {
    const path = `examples/session-02/${file}`;
    const baselinePath = `examples/session-03/${baselineFixturePath(file)}`;
    const expected = renameIdentifiers(baseline.get(baselinePath), {
      ...solution,
      name: "session-02",
    });
    if (!current.includes(path) || readCurrent(path) !== expected) {
      problems.push(`${path} が基準 ${BASELINE_COMMIT} の ${baselinePath} の写しではありません`);
    }
  }
};

export const findFileProblems = (input) => {
  const problems = [];
  const unknown = input.current.filter(
    (file) => !BASELINE_FOLDERS.some(({ name }) => file.startsWith(`examples/${name}/`)),
  );
  if (unknown.length > 0) {
    problems.push(`対応表にないフォルダのファイル:\n${unknown.map((file) => `  ${file}`).join("\n")}`);
  }
  for (const folder of BASELINE_FOLDERS) compareFolder(input, folder, problems);
  compareSession02Copies(input, problems);
  return problems;
};

const findPrefixedScriptProblems = (scripts, prefix, expected) => {
  const problems = [];
  const actual = Object.fromEntries(
    Object.entries(scripts).filter(([name]) => name.startsWith(prefix)),
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

export const findExerciseScriptProblems = (scripts) =>
  findPrefixedScriptProblems(
    scripts,
    "exercise:",
    Object.fromEntries(
      EXERCISE_COMMANDS.map((number) => [
        `exercise:${number}`,
        `pnpm --filter @fp-with-ts/clinic-session-${number} exercise`,
      ]),
    ),
  );

export const DEMO_FOLDERS = [
  ...UNCHANGED_FOLDERS.filter((name) => name.startsWith("session-")),
  ...RENAMED_FOLDERS.map(({ name }) => name),
];

export const findDemoScriptProblems = (scripts) =>
  findPrefixedScriptProblems(
    scripts,
    "demo:",
    Object.fromEntries(
      DEMO_FOLDERS.map((name) => [
        `demo:${name.slice("session-".length)}`,
        `pnpm --filter @fp-with-ts/clinic-${name} dev`,
      ]),
    ),
  );

const COMMAND_SUFFIX = "([0-9][0-9a-z]*(?:-[0-9a-z]+)*)";

const allowedExerciseSuffixes = (folder) => {
  const suffix = folder.slice("session-".length);
  const start = suffix.endsWith("-solution") ? suffix.slice(0, -"-solution".length) : suffix;
  return EXERCISE_COMMANDS.includes(start) ? [start] : [];
};

export const findReadmeProblems = ({ readmes, folders }) => {
  const problems = [];
  for (const [folder, text] of readmes) {
    const readme = `examples/${folder}/README.md`;
    const own = folder.slice("session-".length);
    for (const [, suffix] of text.matchAll(new RegExp(`pnpm demo:${COMMAND_SUFFIX}`, "g"))) {
      if (suffix !== own) {
        problems.push(`${readme} の pnpm demo:${suffix} が自分のフォルダを指していません (想定: pnpm demo:${own})`);
      }
    }
    for (const [, suffix] of text.matchAll(new RegExp(`clinic-session-${COMMAND_SUFFIX}`, "g"))) {
      if (suffix !== own) {
        problems.push(
          `${readme} の clinic-session-${suffix} が自分のフォルダを指していません (想定: clinic-${folder})`,
        );
      }
    }
    const allowed = allowedExerciseSuffixes(folder);
    for (const [, suffix] of text.matchAll(new RegExp(`pnpm exercise:${COMMAND_SUFFIX}`, "g"))) {
      if (!allowed.includes(suffix)) {
        problems.push(
          `${readme} の pnpm exercise:${suffix} が想定と違います (想定: ${
            allowed.length === 0 ? "exercise コマンドなし" : allowed.map((item) => `pnpm exercise:${item}`).join(", ")
          })`,
        );
      }
    }
    for (const [, target] of text.matchAll(new RegExp(`examples/(session-${COMMAND_SUFFIX})`, "g"))) {
      if (!folders.includes(target)) {
        problems.push(`${readme} の examples/${target} は存在しないフォルダを指しています`);
      }
    }
  }
  return problems;
};
