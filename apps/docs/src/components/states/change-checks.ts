import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "types",
    name: "型のテスト",
    detail: "型エラーになることを検証する",
    code: `// @ts-expect-error ← 次の行が型エラーでなければエラー
recordPayment(scheduled, { … }, "…");`,
  },
  {
    id: "lint",
    name: "Linter のルール",
    detail: "コードの書き方を検査する",
    code: `// selector: 検出するコードの形（TSAsExpression は as の式、TSUnknownKeyword は unknown）
selector: "TSAsExpression > TSUnknownKeyword",`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "実行して値を検証する",
    code: `expect(startExamination(checkedIn, veterinarianId, startedAt))
  .toMatchObject({ examinationStartedAt: startedAt, … });`,
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B4-cast-via-unknown",
    kind: "bad",
    label: "kind の検証を削除し、unknown を経由した as で渡す",
    baseCase: "G2-callers-check-state",
    target: "recordPaymentFor の部分",
    diff: [
      { kind: "skip", text: "// import に type AwaitingPayment を追加する" },
      { kind: "same", text: "export const recordPaymentFor = (" },
      { kind: "skip", text: "  // 引数は同じ" },
      { kind: "del", text: "): Paid => {" },
      { kind: "del", text: "  if (current.kind !== \"AwaitingPayment\") throw new Error(\"Invalid appointment state\");" },
      { kind: "del", text: "  return recordPayment(current, input, paidAt);" },
      { kind: "del", text: "};" },
      { kind: "add", text: "): Paid => recordPayment(current as unknown as AwaitingPayment, input, paidAt);" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: "no-restricted-syntax: unknown を経由した型アサーションで、型検査を回避しません。" },
      tests: { found: true, output: "callers.test.ts の 5 件失敗: expected [Function] to throw an error" },
    },
    why: "`recordPaymentFor` は、routes.ts の会計の `kind` の検証を関数に切り出したもので、cases/G2-callers-check-state.ts に定義しています。`recordPayment` の引数の型は変わらないため、型のテストは通ります。unknown を経由した `as` を、Linter のルールが検出します。テストが検出する理由は、`kind` の検証を削除したことであり、`as` を書いたことではありません。",
  },
  {
    id: "B5-start-time-from-check-in",
    kind: "bad",
    label: "診察開始の時刻に来院の時刻を格納する",
    baseCase: "G1-transitions",
    target: "startExamination の部分",
    diff: [
      { kind: "same", text: "export const startExamination = (" },
      { kind: "skip", text: "  // 引数と、examinationStartedAt 以外の項目は同じ" },
      { kind: "same", text: "    veterinarianId," },
      { kind: "del", text: "    examinationStartedAt," },
      { kind: "add", text: "    examinationStartedAt: appointment.checkedInAt," },
      { kind: "same", text: "  }) as const satisfies InExamination;" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "transitions.test.ts の 1 件失敗: expected { kind: 'InExamination', …(8) } to match object { kind: 'InExamination', …(4) }" },
    },
    why: "`examinationStartedAt` と `checkedInAt` はどちらも文字列であるため、型検査と Linter のルールは通ります。診察開始の時刻が格納されたかどうかは、来院と診察開始に異なる時刻を渡すテストだけが検証します。",
  },
  {
    id: "B6-widened-record-payment",
    kind: "bad",
    label: "会計の引数を Appointment 全体に広げる",
    baseCase: "G1-transitions",
    target: "recordPayment の部分",
    diff: [
      { kind: "skip", text: "// import に Appointment を追加する" },
      { kind: "same", text: "export const recordPayment = (" },
      { kind: "del", text: "  appointment: AwaitingPayment," },
      { kind: "add", text: "  appointment: Appointment," },
      { kind: "skip", text: "  // input と paidAt は同じ" },
      { kind: "del", text: "): Paid =>" },
      { kind: "del", text: "  ({ ...appointment, ...input, kind: \"Paid\", paidAt }) as const satisfies Paid;" },
      { kind: "add", text: "): Paid => {" },
      { kind: "add", text: "  if (appointment.kind !== \"AwaitingPayment\") throw new Error(\"Invalid appointment state\");" },
      { kind: "add", text: "  return { ...appointment, ...input, kind: \"Paid\", paidAt } as const satisfies Paid;" },
      { kind: "add", text: "};" },
    ],
    results: {
      types: { found: true, output: "TS2578: Unused '@ts-expect-error' directive." },
      lint: { found: false, output: "エラーなし" },
      tests: { found: false, output: "transitions.test.ts の 2 件すべて成功" },
    },
    why: "広げた引数には Scheduled も渡せるため、型エラーが消え、`// @ts-expect-error` が未使用になります。実行時の検証を追加したため、テストと Linter のルールは通ります。",
  },
];

export const session01ChangeChecks: ChangeCheckSet = {
  example: "session-01-solution",
  ariaLabel: "誤った変更と3つの仕組みの結果",
  mechanisms,
  cases,
};
