import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ALLOWED_EXAMPLE_DIFFS,
  BASELINE_COMMIT,
  DEMO_FOLDERS,
  RENAMED_FOLDERS,
  SESSION_02_COPIES_FROM_SESSION_03,
  baselineFixturePath,
  findDemoScriptProblems,
  findExerciseScriptProblems,
  findFileProblems,
  findReadmeProblems,
  renameIdentifiers,
} from "./baseline-check.mjs";

const COPY_FILES = SESSION_02_COPIES_FROM_SESSION_03;
const TRANSITIONS = "src/domain/appointment/transitions.ts";

const copyEntries = (folder, number, toPath = (file) => file) =>
  COPY_FILES.map((file) => [`examples/${folder}/${toPath(file)}`, `// clinic-session-${number}\n`]);

const FIXTURE = "test/regression/type-fixtures/status-exhaustive.ts";
const BASELINE_FIXTURE = baselineFixturePath(FIXTURE);

const baselineFiles = () =>
  new Map([
    ["examples/session-00/README.md", "# session-00\n"],
    ["examples/session-00/src/zero.ts", "export const zero = 0;\n"],
    ["examples/session-02/package.json", '{"name":"@fp-with-ts/clinic-session-02"}\n'],
    ["examples/session-02/src/a.ts", "// Session 02: pnpm exercise:02\n// S2 regression\n// s2-status-exhaustive.ts\n"],
    [`examples/session-02/${BASELINE_FIXTURE}`, "// s2-status-exhaustive.ts\n"],
    ...copyEntries("session-03", "03", baselineFixturePath),
    ["examples/final/src/final.ts", "export const final = 1;\n"],
    ["examples/fixtures/data.json", '{"fixture":true}\n'],
    ["examples/start-examination-continuity/src/continuity.ts", "export const c = 1;\n"],
  ]);

const currentFiles = () =>
  new Map([
    ["examples/session-00/README.md", "# session-00\n"],
    ["examples/session-00/src/zero.ts", "export const zero = 0;\n"],
    ["examples/session-01/package.json", '{"name":"@fp-with-ts/clinic-session-01"}\n'],
    ["examples/session-01/src/a.ts", "// Session 01: pnpm exercise:01\n// S01 regression\n// status-exhaustive.ts\n"],
    [`examples/session-01/${FIXTURE}`, "// status-exhaustive.ts\n"],
    ["examples/session-02/package.json", '{"name":"@fp-with-ts/clinic-session-02"}\n'],
    ["examples/session-02/src/a.ts", "// Session 02: pnpm exercise:02\n// S01 regression\n// status-exhaustive.ts\n"],
    [`examples/session-02/${FIXTURE}`, "// status-exhaustive.ts\n"],
    ...copyEntries("session-02", "02"),
    ...copyEntries("session-01-solution", "01-solution"),
    ...copyEntries("session-02-solution", "02-solution"),
    ...copyEntries("session-03-supplement", "03-supplement"),
    ["examples/final/src/final.ts", "export const final = 1;\n"],
    ["examples/fixtures/data.json", '{"fixture":true}\n'],
    ["examples/start-examination-continuity/src/continuity.ts", "export const c = 1;\n"],
  ]);

const check = (mutate = () => {}) => {
  const current = currentFiles();
  mutate(current);
  return findFileProblems({
    current: [...current.keys()],
    readCurrent: (file) => current.get(file),
    baseline: baselineFiles(),
  });
};

const changed = (source, file) =>
  `基準 ${BASELINE_COMMIT} の examples/${source} から変わったファイル: ${file}`;

const copyMismatch = (file) =>
  `examples/session-02/${file} が基準 ${BASELINE_COMMIT} の examples/session-03/${baselineFixturePath(file)} の写しではありません`;

const exerciseScripts = () => ({
  test: "vitest run",
  "exercise:01": "pnpm --filter @fp-with-ts/clinic-session-01 exercise",
  "exercise:02": "pnpm --filter @fp-with-ts/clinic-session-02 exercise",
  "exercise:03": "pnpm --filter @fp-with-ts/clinic-session-03 exercise",
  "exercise:03-supplement": "pnpm --filter @fp-with-ts/clinic-session-03-supplement exercise",
  "exercise:04": "pnpm --filter @fp-with-ts/clinic-session-04 exercise",
  "exercise:06": "pnpm --filter @fp-with-ts/clinic-session-06 exercise",
});

describe("基準差分の検査: ファイル", () => {
  test("1. 識別子の振り直しだけの差分は OK になる", () => {
    assert.deepEqual(check(), []);
  });

  test("2. 新フォルダのファイルの中身に許可されていない変更があると NG になる", () => {
    assert.deepEqual(
      check((current) => current.set("examples/session-01/src/a.ts", "// Session 01: changed\n")),
      [changed("session-02", "examples/session-01/src/a.ts")],
    );
    assert.deepEqual(
      check((current) => current.set("examples/session-01/src/extra.ts", "export {};\n")),
      [changed("session-02", "examples/session-01/src/extra.ts")],
    );
    assert.deepEqual(
      check((current) => current.set(`examples/session-02-solution/${TRANSITIONS}`, "// changed\n")),
      [changed("session-03", `examples/session-02-solution/${TRANSITIONS}`)],
    );
  });

  test("2. 振り直し前の識別子が残っていると NG になる", () => {
    assert.deepEqual(
      check((current) => current.set("examples/session-01/src/a.ts", "// Session 02: pnpm exercise:02\n")),
      [changed("session-02", "examples/session-01/src/a.ts")],
    );
  });

  test("2. type-fixtures のファイル名に旧番号が残っていると NG になる", () => {
    const oldPath = `examples/session-01/${BASELINE_FIXTURE}`;
    assert.deepEqual(
      check((current) => {
        current.set(oldPath, current.get(`examples/session-01/${FIXTURE}`));
        current.delete(`examples/session-01/${FIXTURE}`);
      }),
      [changed("session-02", `examples/session-01/${FIXTURE}`), changed("session-02", oldPath)],
    );
  });

  test("2. ファイルの中の type-fixtures の旧ファイル名と旧テスト名の番号が残っていると NG になる", () => {
    assert.deepEqual(
      check((current) =>
        current.set(
          "examples/session-01/src/a.ts",
          "// Session 01: pnpm exercise:01\n// S01 regression\n// s2-status-exhaustive.ts\n",
        ),
      ),
      [changed("session-02", "examples/session-01/src/a.ts")],
    );
    assert.deepEqual(
      check((current) =>
        current.set(
          "examples/session-01/src/a.ts",
          "// Session 01: pnpm exercise:01\n// S2 regression\n// status-exhaustive.ts\n",
        ),
      ),
      [changed("session-02", "examples/session-01/src/a.ts")],
    );
  });

  test("3. 対応表にないフォルダのファイルがあると NG になる", () => {
    assert.deepEqual(
      check((current) => current.set("examples/session-07/src/a.ts", "export {};\n")),
      ["対応表にないフォルダのファイル:\n  examples/session-07/src/a.ts"],
    );
  });

  test("3. 基準を持たない新フォルダ（NEW_FOLDERS）のファイルは OK になる", () => {
    assert.deepEqual(
      check((current) => current.set("examples/session-05-solution/src/a.ts", "export {};\n")),
      [],
    );
  });

  test("4. 元フォルダにあるファイルが新フォルダから消えていると NG になる", () => {
    assert.deepEqual(
      check((current) => current.delete("examples/session-01/src/a.ts")),
      [changed("session-02", "examples/session-01/src/a.ts")],
    );
    assert.deepEqual(
      check((current) => current.delete("examples/session-02/package.json")),
      [changed("session-02", "examples/session-02/package.json")],
    );
    assert.deepEqual(
      check((current) => current.delete(`examples/session-01-solution/${COPY_FILES[1]}`)),
      [changed("session-03", `examples/session-01-solution/${COPY_FILES[1]}`)],
    );
    assert.deepEqual(
      check((current) => current.delete("examples/fixtures/data.json")),
      [changed("fixtures", "examples/fixtures/data.json")],
    );
  });

  test("4. フォルダごと消えていると NG になる", () => {
    assert.deepEqual(
      check((current) => {
        for (const file of [...current.keys()]) {
          if (file.startsWith("examples/session-01/")) current.delete(file);
        }
      }),
      [
        changed("session-02", "examples/session-01/package.json"),
        changed("session-02", "examples/session-01/src/a.ts"),
        changed("session-02", `examples/session-01/${FIXTURE}`),
      ],
    );
  });

  test("5. session-00 / final / fixtures / continuity の差分は NG になる", () => {
    assert.deepEqual(
      check((current) => current.set("examples/session-00/src/zero.ts", "export const zero = 1;\n")),
      [changed("session-00", "examples/session-00/src/zero.ts")],
    );
    assert.deepEqual(
      check((current) => current.set("examples/final/src/final.ts", "export const final = 2;\n")),
      [changed("final", "examples/final/src/final.ts")],
    );
    assert.deepEqual(
      check((current) => current.set("examples/fixtures/data.json", '{"fixture":false}\n')),
      [changed("fixtures", "examples/fixtures/data.json")],
    );
    assert.deepEqual(
      check((current) =>
        current.set("examples/start-examination-continuity/src/continuity.ts", "export const c = 2;\n"),
      ),
      [
        changed(
          "start-examination-continuity",
          "examples/start-examination-continuity/src/continuity.ts",
        ),
      ],
    );
    assert.deepEqual(
      check((current) => current.set("examples/final/src/added.ts", "export {};\n")),
      [changed("final", "examples/final/src/added.ts")],
    );
  });

  test("6. ALLOWED_EXAMPLE_DIFFS に載っているパスの差分は OK になる", () => {
    const allowed = [
      "examples/session-01/README.md",
      "examples/final/README.md",
      "examples/final/src/useCase/logInUseCase.ts",
      "examples/start-examination-continuity/test/snapshotScenario.ts",
    ];
    for (const file of allowed) assert.ok(ALLOWED_EXAMPLE_DIFFS.includes(file), file);
    for (const file of allowed) {
      assert.deepEqual(
        check((current) => current.set(file, "changed\n")),
        [],
        file,
      );
    }
    assert.deepEqual(
      check((current) => current.set("examples/session-00/README.md", "# changed\n")),
      [],
    );
    assert.deepEqual(
      check((current) => current.delete("examples/session-00/README.md")),
      [],
    );
  });

  test("7. 新 session-02 が旧 session-03 から写したファイルの内容が違うと NG になる", () => {
    for (const file of COPY_FILES) {
      assert.deepEqual(
        check((current) => current.set(`examples/session-02/${file}`, "// changed\n")),
        [copyMismatch(file)],
        file,
      );
    }
    assert.deepEqual(
      check((current) =>
        current.set(`examples/session-02/${TRANSITIONS}`, "// clinic-session-03\n"),
      ),
      [copyMismatch(TRANSITIONS)],
    );
    assert.deepEqual(
      check((current) => current.delete(`examples/session-02/${TRANSITIONS}`)),
      [copyMismatch(TRANSITIONS)],
    );
  });
});

describe("基準差分の検査: フォルダ移動", () => {
  const LAYOUT_BASELINE = {
    "examples/session-02/src/web/routes.ts":
      'import { app } from "../app.js";\nimport { view } from "./view.js";\nimport { ok } from "../shared/result.js";\nexport const routes = [app, view, ok];\n',
    "examples/session-02/src/boundary/examResult.ts": 'import { ok } from "../shared/result.js";\nexport const parse = ok;\n',
    "examples/session-02/src/shared/result.ts": "export const ok = 1;\n",
    "examples/session-02/test/web/routes.test.ts":
      'import { routes } from "../../src/web/routes.js";\nconst path = "src/web/routes.ts";\n',
    "examples/session-02/src/app.ts": 'import { routes } from "./web/routes.js";\nexport const app = routes;\n',
    "examples/session-02/src/boundary/boundary.test-types.ts": "export {};\n",
    ...Object.fromEntries(copyEntries("session-03", "03", baselineFixturePath)),
  };

  const LAYOUT_CURRENT = {
    "examples/session-01/src/adaptor/primary/web/routes.ts":
      'import { app } from "../../../app.js";\nimport { view } from "./view.js";\nimport { ok } from "../../../domain/shared/result.js";\nexport const routes = [app, view, ok];\n',
    "examples/session-01/src/adaptor/primary/web/examResult.ts":
      'import { ok } from "../../../domain/shared/result.js";\nexport const parse = ok;\n',
    "examples/session-01/src/domain/shared/result.ts": "export const ok = 1;\n",
    "examples/session-01/test/web/routes.test.ts":
      'import { routes } from "../../src/adaptor/primary/web/routes.js";\nconst path = "src/adaptor/primary/web/routes.ts";\n',
    "examples/session-01/src/app.ts":
      'import { routes } from "./adaptor/primary/web/routes.js";\nexport const app = routes;\n',
  };

  const layoutCheck = (mutate = () => {}, baselineOverrides = {}) => {
    const baseline = new Map(Object.entries({ ...LAYOUT_BASELINE, ...baselineOverrides }));
    const current = new Map(Object.entries(LAYOUT_CURRENT));
    mutate(current);
    return findFileProblems({
      current: [...current.keys()],
      readCurrent: (file) => current.get(file),
      baseline,
    }).filter((problem) => problem.includes("ファイル: examples/session-01/"));
  };

  test("12. 移動して import の深さだけが変わったファイルは OK になる", () => {
    assert.deepEqual(layoutCheck(), []);
  });

  test("12. 移動したファイルの import 以外の行が変わると NG になる", () => {
    const file = "examples/session-01/src/adaptor/primary/web/routes.ts";
    assert.deepEqual(
      layoutCheck((current) =>
        current.set(file, current.get(file).replace("[app, view, ok]", "[app, view, no]")),
      ),
      [changed("session-02", file)],
    );
  });

  test("12. 移動したファイルの import の指す先が変わると NG になる", () => {
    const file = "examples/session-01/src/adaptor/primary/web/routes.ts";
    assert.deepEqual(
      layoutCheck((current) =>
        current.set(file, current.get(file).replace('"./view.js"', '"./views.js"')),
      ),
      [changed("session-02", file)],
    );
  });

  test("12. boundary.test-types.ts の中身が export {}; 以外だと NG になる", () => {
    assert.deepEqual(
      layoutCheck(() => {}, {
        "examples/session-02/src/boundary/boundary.test-types.ts": "export const kept = 1;\n",
      }),
      [changed("session-02", "examples/session-01/src/adaptor/primary/web/boundary.test-types.ts")],
    );
  });
});

describe("基準差分の検査: exercise:*", () => {
  test("8. 想定の6本なら OK になる", () => {
    assert.deepEqual(findExerciseScriptProblems(exerciseScripts()), []);
  });

  test("8. 想定と違うと NG になる", () => {
    const missing = exerciseScripts();
    delete missing["exercise:06"];
    assert.deepEqual(findExerciseScriptProblems(missing), [
      "package.json の exercise:06 が想定と違います\n  想定: pnpm --filter @fp-with-ts/clinic-session-06 exercise\n  現在: (なし)",
    ]);

    assert.deepEqual(
      findExerciseScriptProblems({
        ...exerciseScripts(),
        "exercise:05": "pnpm --filter @fp-with-ts/clinic-session-05 exercise",
      }),
      [
        "package.json の exercise:05 が想定と違います\n  想定: (なし)\n  現在: pnpm --filter @fp-with-ts/clinic-session-05 exercise",
      ],
    );

    assert.deepEqual(
      findExerciseScriptProblems({
        ...exerciseScripts(),
        "exercise:04": "pnpm --filter @fp-with-ts/clinic-session-05 exercise",
      }),
      [
        "package.json の exercise:04 が想定と違います\n  想定: pnpm --filter @fp-with-ts/clinic-session-04 exercise\n  現在: pnpm --filter @fp-with-ts/clinic-session-05 exercise",
      ],
    );
  });
});

describe("基準差分の検査: テスト名の番号とファイル名", () => {
  const folder = RENAMED_FOLDERS.find(({ name }) => name === "session-03");

  test("9. 旧 S2 / S3 / S4 / S5 の regression は今の番号になる", () => {
    const cases = [
      ['describe("S2 regression: a")', 'describe("S01 regression: a")'],
      ['describe("S3 regression: a")', 'describe("S03 補助演習 regression: a")'],
      ['describe("S4 regression: a")', 'describe("S03 regression: a")'],
      ['describe("S5 regression: a")', 'describe("S04 regression: a")'],
      ['describe("S5 Step 1 regression: a")', 'describe("S04 Step 1 regression: a")'],
      ['describe("S5 Step 4 regression: a")', 'describe("S04 Step 4 regression: a")'],
    ];
    for (const [before, after] of cases) assert.equal(renameIdentifiers(before, folder), after);
  });

  test("9. type-fixtures のファイル名から旧番号が外れる", () => {
    const cases = [
      ["s2-paid-cannot-start.ts", "paid-not-assignable-to-checked-in.ts"],
      ["s3-start-examination-requires-typed-ids.ts", "start-examination-requires-typed-ids.ts"],
      ["s4-exam-result-readonly.ts", "exam-result-readonly.ts"],
    ];
    for (const [before, after] of cases) {
      assert.equal(renameIdentifiers(`compileTypeFixture("${before}")`, folder), `compileTypeFixture("${after}")`);
      assert.equal(baselineFixturePath(`test/regression/type-fixtures/${after}`), `test/regression/type-fixtures/${before}`);
    }
  });
});

const demoScripts = () => ({
  test: "vitest run",
  ...Object.fromEntries(
    DEMO_FOLDERS.map((name) => [
      `demo:${name.slice("session-".length)}`,
      `pnpm --filter @fp-with-ts/clinic-${name} dev`,
    ]),
  ),
});

describe("基準差分の検査: demo:*", () => {
  test("10. 想定の14本なら OK になる", () => {
    assert.equal(DEMO_FOLDERS.length, 14);
    assert.deepEqual(findDemoScriptProblems(demoScripts()), []);
  });

  test("10. demo:03 が session-04 を指すと NG になる", () => {
    assert.deepEqual(
      findDemoScriptProblems({
        ...demoScripts(),
        "demo:03": "pnpm --filter @fp-with-ts/clinic-session-04 dev",
      }),
      [
        "package.json の demo:03 が想定と違います\n  想定: pnpm --filter @fp-with-ts/clinic-session-03 dev\n  現在: pnpm --filter @fp-with-ts/clinic-session-04 dev",
      ],
    );
  });

  test("10. 値の一部だけが合っていても NG になる", () => {
    for (const value of [
      "pnpm --filter @fp-with-ts/clinic-session-03 start",
      "pnpm --filter @fp-with-ts/clinic-session-03-solution dev",
      "pnpm --filter @fp-with-ts/clinic-session-03 dev && echo",
    ]) {
      assert.equal(findDemoScriptProblems({ ...demoScripts(), "demo:03": value }).length, 1, value);
    }
  });

  test("10. キーが足りない、または余分だと NG になる", () => {
    const missing = demoScripts();
    delete missing["demo:06-solution"];
    assert.deepEqual(findDemoScriptProblems(missing), [
      "package.json の demo:06-solution が想定と違います\n  想定: pnpm --filter @fp-with-ts/clinic-session-06-solution dev\n  現在: (なし)",
    ]);

    assert.deepEqual(
      findDemoScriptProblems({
        ...demoScripts(),
        "demo:07": "pnpm --filter @fp-with-ts/clinic-session-07 dev",
      }),
      [
        "package.json の demo:07 が想定と違います\n  想定: (なし)\n  現在: pnpm --filter @fp-with-ts/clinic-session-07 dev",
      ],
    );
  });
});

const FOLDERS = ["session-00", "session-03", "session-03-solution", "session-03-supplement", "session-05"];

const readmeProblems = (readmes) =>
  findReadmeProblems({ readmes: new Map(Object.entries(readmes)), folders: FOLDERS });

describe("README の番号の検査", () => {
  test("11. 自分のフォルダを指す README は OK になる", () => {
    assert.deepEqual(
      readmeProblems({
        "session-03": [
          "pnpm demo:03",
          "pnpm --filter @fp-with-ts/clinic-session-03 test",
          "`pnpm exercise:03` を実行します。解答は `examples/session-03-solution/src` にあります。",
        ].join("\n"),
        "session-03-solution": "pnpm demo:03-solution\npnpm exercise:03\n`examples/session-03` が開始です。",
        "session-03-supplement": "pnpm demo:03-supplement\npnpm exercise:03-supplement",
        "session-05": "`pnpm demo:05` で起動します。",
      }),
      [],
    );
  });

  test("11. pnpm demo: が別のフォルダを指すと NG になる", () => {
    assert.deepEqual(readmeProblems({ "session-03": "pnpm demo:04\n" }), [
      "examples/session-03/README.md の pnpm demo:04 が自分のフォルダを指していません (想定: pnpm demo:03)",
    ]);
    assert.deepEqual(readmeProblems({ "session-03-solution": "pnpm demo:03\n" }), [
      "examples/session-03-solution/README.md の pnpm demo:03 が自分のフォルダを指していません (想定: pnpm demo:03-solution)",
    ]);
  });

  test("11. clinic-session- が別のフォルダを指すと NG になる", () => {
    assert.deepEqual(
      readmeProblems({ "session-03": "pnpm --filter @fp-with-ts/clinic-session-03-solution test\n" }),
      [
        "examples/session-03/README.md の clinic-session-03-solution が自分のフォルダを指していません (想定: clinic-session-03)",
      ],
    );
  });

  test("11. 存在しない examples/session-* を指すと NG になる", () => {
    assert.deepEqual(readmeProblems({ "session-03": "`examples/session-07/src` を見ます。\n" }), [
      "examples/session-03/README.md の examples/session-07 は存在しないフォルダを指しています",
    ]);
  });

  test("11. pnpm exercise: は開始フォルダでは自分、-solution では対応する開始フォルダだけを許す", () => {
    assert.deepEqual(readmeProblems({ "session-03": "pnpm exercise:04\n" }), [
      "examples/session-03/README.md の pnpm exercise:04 が想定と違います (想定: pnpm exercise:03)",
    ]);
    assert.deepEqual(readmeProblems({ "session-03-solution": "pnpm exercise:03-supplement\n" }), [
      "examples/session-03-solution/README.md の pnpm exercise:03-supplement が想定と違います (想定: pnpm exercise:03)",
    ]);
    assert.deepEqual(readmeProblems({ "session-03-supplement": "pnpm exercise:03\n" }), [
      "examples/session-03-supplement/README.md の pnpm exercise:03 が想定と違います (想定: pnpm exercise:03-supplement)",
    ]);
    assert.deepEqual(readmeProblems({ "session-05": "pnpm exercise:05\n" }), [
      "examples/session-05/README.md の pnpm exercise:05 が想定と違います (想定: exercise コマンドなし)",
    ]);
  });

  test("11. 実際の examples/*/README.md は OK になる", () => {
    const examples = join(dirname(fileURLToPath(import.meta.url)), "..", "examples");
    const folders = readdirSync(examples, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    const readmes = new Map(
      folders
        .filter((folder) => folder.startsWith("session-") && existsSync(join(examples, folder, "README.md")))
        .map((folder) => [folder, readFileSync(join(examples, folder, "README.md"), "utf8")]),
    );
    assert.ok(readmes.size >= DEMO_FOLDERS.length);
    assert.deepEqual(findReadmeProblems({ readmes, folders }), []);
  });
});
