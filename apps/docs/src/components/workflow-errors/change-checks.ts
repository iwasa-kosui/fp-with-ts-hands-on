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
    detail: "テスト用の Store で、呼び出しの結果（outcome）を検証する",
    code: `expect(outcome.kind).toBe("returned");`,
  },
];

const cases: readonly ChangeCase[] = [
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
      lint: { found: true, output: "no-restricted-syntax: _unsafeUnwrap は失敗のとき例外を投げます。", setting: "selector: \"CallExpression[callee.property.name='_unsafeUnwrap']\"," },
      tests: { found: true, output: "2件失敗: expected 'threw' to be 'returned'" },
    },
    why: "`_unsafeUnwrap` は失敗のとき例外を投げますが、型はそれを表しません。Linter のルールとテストの両方が検出します。演習の検証は cases/ の中のコードだけを検査するため、route の入力の検査が使う `_unsafeUnwrap` は検査されません。実際のプロジェクトでは、`files` で useCase に限定します。",
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
    why: "`default` が受けるため、型検査は通ります。Linter のルールが検出し、テストはまだないため対象外です。",
  },
];

export const session04ChangeChecks: ChangeCheckSet = {
  example: "session-04-solution",
  ariaLabel: "誤った変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
