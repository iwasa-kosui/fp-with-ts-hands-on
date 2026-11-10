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
    code: `expect(result.isErr()).toBe(true);`,
  },
];

const cases: readonly ChangeCase[] = [
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
    why: "useCase は domain より外側の層です。向きが逆でも型検査は通り、実行結果も変わらないため、ルールだけが検出します。",
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
      tests: { found: false, output: "このファイルを実行するテストは 0 件", setting: "// import を追加しても実行結果は変わりません" },
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
