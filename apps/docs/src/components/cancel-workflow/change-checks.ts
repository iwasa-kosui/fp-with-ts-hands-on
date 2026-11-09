import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "lint",
    name: "Linter の規則",
    detail: "import の文字列がパターンに一致すると報告する",
    code: `"no-restricted-imports": ["error",
  { patterns: ["**/<禁止するフォルダ名>/**"] }]`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "偽物の Store で確かめる",
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
    why: "import の先は実在するので、型検査は通ります。import の向きを変えても実行結果は変わらないので、値を確かめるテストでは見つけられません。import の文字列を見る規則だけが見つけます。",
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
    why: "型だけの import でも、domain は保存の形を知ることになります。実行結果は変わらないのでテストでは見つけられません。規則は `import type` も同じように報告します。",
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
    why: "useCase は domain の外側です。向きが逆でも型検査は通り、実行結果も変わらないので、規則だけが見つけます。",
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
    why: "`as` で型を合わせているので、型検査は通ります。import は変わらないので規則も通ります。Paid を渡すテストだけが見つけます。",
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
      tests: { found: false, output: "このファイルを実行するテストは 0 件", notRun: true, setting: "// import を足しても実行結果は変わりません" },
    },
    why: "`webBookingChannel` は domain の中のファイルです。パターンをフォルダの単位で書けば、名前に web を含むだけのファイルを誤検知（正しいコードを悪い変更として検出すること）しません。",
  },
];

export const session05ChangeChecks: ChangeCheckSet = {
  example: "session-05-solution",
  ariaLabel: "悪い変更と2つの仕組みの結果",
  mechanisms,
  cases,
};
