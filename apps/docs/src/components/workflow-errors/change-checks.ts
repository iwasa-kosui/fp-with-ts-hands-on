import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "lint",
    name: "Linter のルール",
    detail: "書き方を検査する",
    code: `// selector: 検出するコードの形
selector: "VariableDeclarator[id.name='startExamination'] ThrowStatement",`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "テスト用の Store で検証する",
    code: `expect(outcome.kind).toBe("returned");
expect(saved).toHaveLength(0);`,
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-throw-in-use-case",
    kind: "bad",
    label: "useCase が自分で throw する",
    baseCase: "G1-solution",
    target: "startExamination の部分",
    diff: [
      { kind: "skip", text: "// import と、関数の本体を { } で囲む形を変える" },
      { kind: "del", text: "    ensureAppointmentFound(" },
      { kind: "skip", text: "    // 続く resolveById から .andThen までの 4 行も消す" },
      { kind: "add", text: "    const found = deps.resolver.resolveById(input.appointmentId);" },
      { kind: "add", text: "    if (found === undefined) {" },
      { kind: "add", text: "      throw new Error(`Appointment not found: ${input.appointmentId}`);" },
      { kind: "add", text: "    }" },
      { kind: "add", text: "    return ensureCheckedIn(found)" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: throw しません。失敗は err で返します。" },
      tests: { found: true, output: "1件失敗: expected 'threw' to be 'returned'" },
    },
    why: "戻り値の型は変わらないため、型検査は通ります。`throw` の使用を検出するルールと、例外が発生しないことを検証するテストが検出します。",
  },
  {
    id: "B2-save-after-failure",
    kind: "bad",
    label: "失敗した後も保存する",
    baseCase: "G1-solution",
    target: "startExamination の部分",
    diff: [
      { kind: "skip", text: "    // ensureAppointmentFound(...) の呼び出しは同じ" },
      { kind: "del", text: "    )" },
      { kind: "del", text: "      .andThen(ensureCheckedIn)" },
      { kind: "add", text: "    ).andThen((appointment) => {" },
      { kind: "add", text: "      const started = transitionToInExamination(" },
      { kind: "add", text: "        appointment as CheckedIn," },
      { kind: "skip", text: "        // input の 2 項目は同じ。元の 2 つの .map は消す" },
      { kind: "add", text: "      deps.store.save(started);" },
      { kind: "add", text: "      return ensureCheckedIn(appointment).map(() => started);" },
      { kind: "add", text: "    });" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "1件失敗: expected [ { kind: 'InExamination', …(7) } ] to have a length of +0 but got 1" },
    },
    why: "保存する順序は型にもコードの書き方にも現れません。`saved` の中身を検証するテストだけが検出します。",
  },
  {
    id: "B3-store-failure-to-business-error",
    kind: "bad",
    label: "保存の障害を業務の失敗にする",
    baseCase: "G1-solution",
    target: "startExamination の部分",
    diff: [
      { kind: "del", text: "      .map((appointment) => {" },
      { kind: "add", text: "      .andThen((appointment) => {" },
      { kind: "add", text: "        try {" },
      { kind: "add", text: "          deps.store.save(appointment);" },
      { kind: "add", text: "          return ok(appointment);" },
      { kind: "add", text: "        } catch {" },
      { kind: "skip", text: "          // catch の中で err({ kind: \"AppointmentNotFound\", … }) を返す" },
      { kind: "add", text: "        }" },
      { kind: "same", text: "      });" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "1件失敗: expected 'returned' to be 'threw'", setting: "expect(outcome.kind).toBe(\"threw\");" },
    },
    why: "障害を Err に変えても型は一致します。例外がそのまま useCase の外へ伝わることを検証するテストだけが検出します。",
  },
  {
    id: "B4-unsafe-unwrap",
    kind: "bad",
    label: "_unsafeUnwrap で例外に戻す",
    baseCase: "G1-solution",
    target: "startExamination の部分",
    diff: [
      { kind: "del", text: "    ensureAppointmentFound(" },
      { kind: "add", text: "    const appointment = ensureAppointmentFound(" },
      { kind: "skip", text: "      // 関数の本体を { } で囲む。resolveById と .andThen(ensureCheckedIn) は同じ" },
      { kind: "add", text: "      ._unsafeUnwrap();" },
      { kind: "add", text: "    const started = transitionToInExamination(" },
      { kind: "skip", text: "      // 引数は同じ。元の 2 つの .map は消す" },
      { kind: "add", text: "    deps.store.save(started);" },
      { kind: "add", text: "    return ok(started);" },
      { kind: "add", text: "  };" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-syntax: _unsafeUnwrap は失敗のとき例外を投げます。", setting: "selector: \"CallExpression[…]\"," },
      tests: { found: true, output: "2件失敗: expected 'threw' to be 'returned'" },
    },
    why: "`_unsafeUnwrap` は失敗のとき例外を投げますが、型はそれを表しません。呼び出しを検出するルールと、例外が発生しないことを検証するテストが検出します。",
  },
  {
    id: "B5-error-kind-swallowed",
    kind: "bad",
    label: "失敗の種類を追加して default で受ける",
    baseCase: "G2-notice-assert-never",
    target: "お知らせコードの部分",
    diff: [
      { kind: "skip", text: "// import は同じ。AppointmentCancelled 型を追加し、assertNever を消す" },
      { kind: "same", text: "export const toStartExaminationNoticeCode = (" },
      { kind: "del", text: "  error: StartExaminationError," },
      { kind: "add", text: "  error: StartExaminationError | AppointmentCancelled," },
      { kind: "skip", text: "    // 2 つの case は、戻り値を文字列で直接記述する" },
      { kind: "same", text: "    default:" },
      { kind: "del", text: "      return assertNever(error);" },
      { kind: "add", text: "      return \"invalid-state\";" },
    ],
    results: {
      lint: { found: true, output: "switch-exhaustiveness-check: Switch is not exhaustive. Cases not matched: \"AppointmentCancelled\"", setting: `"@typescript-eslint/switch-exhaustiveness-check"
{ considerDefaultExhaustiveForUnions: false }` },
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// この分岐のテストはまだありません" },
    },
    why: "`default` が受けるため、型検査は通ります。テストはまだないため、`default` を候補に数えないルールだけが検出します。",
  },
];

export const session04ChangeChecks: ChangeCheckSet = {
  example: "session-04-solution",
  ariaLabel: "誤った変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
