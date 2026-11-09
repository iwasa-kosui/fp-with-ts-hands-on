import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "types",
    name: "型のテスト",
    detail: "型エラーになることを確かめる",
    code: `// @ts-expect-error ← 次の行が型エラーでなければエラー
startExamination(scheduled, "…", "…");`,
  },
  {
    id: "lint",
    name: "Linter の規則",
    detail: "書き方を見る",
    code: `// selector: 検出するコードの形（TSAsExpression は as の式）
selector: "TSAsExpression > TSTypeReference[…]",`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "実行して値を確かめる",
    code: `expect(cancel(scheduled, "schedule conflict", at))
  .toMatchObject({ reason: "schedule conflict", … });`,
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-cast-start-examination",
    kind: "bad",
    label: "引数を as で偽って渡す",
    baseCase: "G2-callers-check-state",
    target: "startExaminationFor の部分",
    diff: [
      { kind: "skip", text: "// import に type CheckedIn を足す" },
      { kind: "same", text: "export const startExaminationFor = (" },
      { kind: "skip", text: "  // 引数は同じ" },
      { kind: "del", text: "): InExamination => {" },
      { kind: "del", text: "  if (current.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");" },
      { kind: "del", text: "  return startExamination(current, veterinarianId, examinationStartedAt);" },
      { kind: "del", text: "};" },
      { kind: "add", text: "): InExamination =>" },
      { kind: "add", text: "  startExamination(current as CheckedIn, veterinarianId, examinationStartedAt);" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: "no-restricted-syntax: 予約の状態の型へ as で変えず、kind を確かめて絞り込みます。" },
      tests: { found: true, output: "5件失敗: expected [Function] to throw an error", setting: "expect(() => startExaminationFor(appointment, veterinarianId, at)).toThrow();" },
    },
    why: "`as` で型検査を黙らせても、`startExamination` の引数の型は変わらないので、型のテストは通ります。`as` の書き方を見る規則と、実行して確かめるテストが見つけます。",
  },
  {
    id: "B2-widened-start-examination",
    kind: "bad",
    label: "診察開始の引数を Appointment に広げる",
    baseCase: "G1-transitions",
    target: "startExamination の部分",
    diff: [
      { kind: "skip", text: "// import に Appointment を足す" },
      { kind: "same", text: "export const startExamination = (" },
      { kind: "del", text: "  appointment: CheckedIn," },
      { kind: "add", text: "  appointment: Appointment," },
      { kind: "skip", text: "  // veterinarianId と examinationStartedAt は同じ" },
      { kind: "del", text: "): InExamination =>" },
      { kind: "del", text: "  ({" },
      { kind: "add", text: "): InExamination => {" },
      { kind: "add", text: "  if (appointment.kind !== \"CheckedIn\") throw new Error(\"Invalid appointment state\");" },
      { kind: "add", text: "  return {" },
      { kind: "skip", text: "    // 返す値は同じ。末尾は }; で閉じる" },
    ],
    results: {
      types: { found: true, output: "TS2578: Unused '@ts-expect-error' directive." },
      lint: { found: false, output: "エラーなし" },
      tests: { found: false, output: "2件成功" },
    },
    why: "広げた引数には Scheduled も渡せるので、型エラーが消えて `// @ts-expect-error` の印が余ります。実行時の確認を足したので、テストと規則は通ります。",
  },
  {
    id: "B3-cancel-keeps-visit-reason",
    kind: "bad",
    label: "キャンセルに来院の理由を残す",
    baseCase: "G1-transitions",
    target: "cancel の部分",
    diff: [
      { kind: "same", text: "export const cancel = (" },
      { kind: "skip", text: "  // 引数と、reason 以外の項目は同じ" },
      { kind: "same", text: "    scheduledAt: appointment.scheduledAt," },
      { kind: "del", text: "    reason," },
      { kind: "add", text: "    reason: appointment.reason," },
      { kind: "same", text: "    canceledAt," },
      { kind: "same", text: "  }) as const satisfies Canceled;" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "1件失敗: expected { kind: 'Canceled', …(6) } to match object { kind: 'Canceled', …(4) }" },
    },
    why: "どちらの理由も同じ型の文字列なので、型検査と規則は通ります。どの値が結果に入るかは、テストだけが確かめます。",
  },
];

export const session01ChangeChecks: ChangeCheckSet = {
  example: "session-01-solution",
  ariaLabel: "悪い変更と3つの仕組みの結果",
  mechanisms,
  cases,
};
