import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "lint",
    name: "Linter のルール",
    detail: "import の文字列がパターンに一致すると報告する",
    code: `"no-restricted-imports": ["error",
  { patterns: ["**/<禁止するフォルダ名>/**"] }]`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "テスト用の Store で検証する",
    code: `expect(result.isErr()).toBe(true);
expect(saved).toHaveLength(0);`,
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-domain-imports-web",
    kind: "bad",
    label: "domain が web の関数を import する",
    baseCase: "G1-appointment",
    target: "domain の appointment.ts",
    diff: [
      { kind: "same", text: "import type { CancellationReason } from \"../../../src/domain/appointment/cancellationReason.js\";" },
      { kind: "add", text: "import { presentAppointment } from \"../../../src/adaptor/primary/web/appointmentPresenter.js\";" },
      { kind: "skip", text: "// 型の定義と cancel は同じ" },
      { kind: "add", text: "export const describeAppointment = (appointment: Appointment): string =>" },
      { kind: "add", text: "  presentAppointment(appointment).status;" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-imports: '…/adaptor/primary/web/appointmentPresenter.js' import is restricted from being used by a pattern." },
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// import の向きは実行結果に現れません" },
    },
    why: "import の先は実在するため、型検査は通ります。import の向きを変えても実行結果は変わらないため、値を検証するテストでは検出できません。import の文字列を検査するルールだけが検出します。",
  },
  {
    id: "B2-domain-imports-sqlite",
    kind: "bad",
    label: "domain が sqlite の行の型を import する",
    baseCase: "G1-appointment",
    target: "domain の appointment.ts",
    diff: [
      { kind: "same", text: "import type { CancellationReason } from \"../../../src/domain/appointment/cancellationReason.js\";" },
      { kind: "add", text: "import type { AppointmentRow } from \"../../../src/adaptor/secondary/sqlite/appointmentRow.js\";" },
      { kind: "skip", text: "// 型の定義と cancel は同じ" },
      { kind: "add", text: "export type PersistedAppointment = AppointmentRow;" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-imports: '…/adaptor/secondary/sqlite/appointmentRow.js' import is restricted from being used by a pattern." },
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// import の向きは実行結果に現れません" },
    },
    why: "型だけの import でも、domain は保存形式に依存することになります。実行結果は変わらないため、テストでは検出できません。ルールは `import type` も同様に報告します。",
  },
  {
    id: "B4-domain-imports-use-case",
    kind: "bad",
    label: "domain が useCase を import する",
    baseCase: "G1-appointment",
    target: "domain の appointment.ts",
    diff: [
      { kind: "same", text: "import type { CancellationReason } from \"../../../src/domain/appointment/cancellationReason.js\";" },
      { kind: "add", text: "import type { CancelError } from \"../../../src/useCase/cancelAppointment.js\";" },
      { kind: "skip", text: "// 型の定義と cancel は同じ" },
      { kind: "add", text: "export type CancelFailure = CancelError;" },
    ],
    results: {
      lint: { found: true, output: "no-restricted-imports: '…/useCase/cancelAppointment.js' import is restricted from being used by a pattern." },
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// import の向きは実行結果に現れません" },
    },
    why: "useCase は domain の外側です。向きが逆でも型検査は通り、実行結果も変わらないため、ルールだけが検出します。",
  },
  {
    id: "B3-cancel-paid",
    kind: "bad",
    label: "会計済みもキャンセルに通す",
    baseCase: "G2-cancel-appointment",
    target: "ensureCancellable の部分",
    diff: [
      { kind: "same", text: "): Result<Scheduled | CheckedIn, InvalidAppointmentState> =>" },
      { kind: "del", text: "  appointment.kind === \"Scheduled\" || appointment.kind === \"CheckedIn\"" },
      { kind: "del", text: "    ? ok(appointment)" },
      { kind: "del", text: "    : err({" },
      { kind: "add", text: "  appointment.kind === \"Canceled\"" },
      { kind: "add", text: "    ? err({" },
      { kind: "skip", text: "        // kind、appointmentId、actualKind は同じ" },
      { kind: "del", text: "      });" },
      { kind: "add", text: "      })" },
      { kind: "add", text: "    : ok(appointment as Scheduled | CheckedIn);" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: true, output: "1件失敗: expected false to be true" },
    },
    why: "`as` で型を合わせているため、型検査は通ります。import は変わらないため、Linter のルールでも検出されません。Paid を渡すテストだけが検出します。",
  },
  {
    id: "G3-web-booking-channel",
    kind: "good",
    label: "名前に web を含む型（正しいコード）",
    baseCase: "G1-appointment",
    target: "domain の appointment.ts",
    diff: [
      { kind: "same", text: "import type { CancellationReason } from \"../../../src/domain/appointment/cancellationReason.js\";" },
      { kind: "add", text: "import { isBookedOnWeb, type BookingChannel } from \"../../../src/domain/appointment/webBookingChannel.js\";" },
      { kind: "skip", text: "// 型の定義と cancel は同じ" },
      { kind: "add", text: "export const isWebBooking = (channel: BookingChannel): boolean =>" },
      { kind: "add", text: "  isBookedOnWeb(channel);" },
    ],
    results: {
      lint: { found: false, output: "エラーなし" },
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// import を追加しても実行結果は変わりません" },
    },
    why: "`webBookingChannel` は domain の中のファイルです。パターンをフォルダの単位で記述すれば、名前に web を含むだけのファイルを誤検知（正しいコードを誤った変更として検出すること）しません。",
  },
];

export const session05ChangeChecks: ChangeCheckSet = {
  example: "session-05-solution",
  ariaLabel: "誤った変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
