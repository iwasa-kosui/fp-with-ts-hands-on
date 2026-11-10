import type { ChangeCase, ChangeCheckSet, MechanismInfo } from "../change-checks/types";

const mechanisms: readonly MechanismInfo[] = [
  {
    id: "types",
    name: "型のテスト",
    detail: "Extra（残す3項目以外の項目名の型）に項目名を代入すると型エラーになることを検証する",
    code: `type Extra = Exclude<keyof Payload, "appointmentId" | …>;
// @ts-expect-error ← 次の行が型エラーでなければエラー
const extra: Extra = "ownerContact";`,
  },
  {
    id: "lint",
    name: "Linter のルール",
    detail: "`rules` に記述する",
    code: "// ルールの一覧は図の下にあります",
  },
  {
    id: "tests",
    name: "値の性質のテスト",
    detail: "ランダムな入力を多数試す",
    code: `fc.assert(fc.property(notUuid, (id) =>
  StartExaminationInput.parse({ appointmentId: id, … }).isErr()));`,
  },
];

const cases: readonly ChangeCase[] = [
  {
    id: "B1-any-parser",
    kind: "bad",
    label: "any で受けて検査しない",
    baseCase: "G1-solution",
    target: "parse の部分",
    diff: [
      { kind: "skip", text: "// import と型の定義は schema を使わない形に変える" },
      { kind: "same", text: "export const StartExaminationInput = {" },
      { kind: "del", text: "  schema," },
      { kind: "del", text: "  parse: schemaResult(schema)," },
      { kind: "add", text: "  parse: (raw: any): Result<StartExaminationInput> =>" },
      { kind: "add", text: "    ok({" },
      { kind: "add", text: "      appointmentId: raw.appointmentId," },
      { kind: "add", text: "      veterinarianId: raw.veterinarianId," },
      { kind: "add", text: "    })," },
      { kind: "same", text: "} as const;" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: "no-explicit-any: Unexpected any. Specify a different type.", setting: "\"@typescript-eslint/no-explicit-any\": \"error\"" },
      tests: { found: true, output: "3件失敗: Property failed" },
    },
    why: "`any` は型検査を無効にするため、型検査（tsc）は通ります。書き方を検査するルールと、不正な値を渡すテストが検出します。",
  },
  {
    id: "B2-unknown-cast",
    kind: "bad",
    label: "unknown を as で通す",
    baseCase: "G1-solution",
    target: "parse の部分",
    diff: [
      { kind: "skip", text: "// import と型の定義は schema を使わない形に変える" },
      { kind: "same", text: "export const StartExaminationInput = {" },
      { kind: "del", text: "  schema," },
      { kind: "del", text: "  parse: schemaResult(schema)," },
      { kind: "add", text: "  parse: (raw: unknown): Result<StartExaminationInput> =>" },
      { kind: "add", text: "    ok(raw as StartExaminationInput)," },
      { kind: "same", text: "} as const;" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: "consistent-type-assertions: Do not use any type assertions.", setting: `"@typescript-eslint/consistent-type-assertions":
  ["error", { assertionStyle: "never" }]` },
      tests: { found: true, output: "2件失敗: Property failed after 1 tests" },
    },
    why: "`as` は値を検証せず、型だけを変えます。ルールが `as` の使用を検出し、テストが UUID でない値を通すことを検出します。",
  },
  {
    id: "B5-handler-bypasses-parse",
    kind: "bad",
    label: "route が parse を通さない",
    baseCase: "G2-handler-uses-parse",
    target: "handle の部分",
    diff: [
      { kind: "skip", text: "// import は type import に変える" },
      { kind: "same", text: "export const handle = async (" },
      { kind: "same", text: "): Promise<Readonly<{ status: number }>> => {" },
      { kind: "del", text: "  const input = StartExaminationInput.parse(await c.req.json())._unsafeUnwrap();" },
      { kind: "del", text: "  run(input);" },
      { kind: "add", text: "  const body = await c.req.json();" },
      { kind: "add", text: "  run(body);" },
      { kind: "same", text: "  return { status: 200 };" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: "no-unsafe-assignment: Unsafe assignment of an `any` value.", setting: `"@typescript-eslint/no-unsafe-assignment": "error"
"@typescript-eslint/no-unsafe-argument": "error"` },
      tests: { found: true, output: "1件失敗: Property failed after 1 tests", setting: `// call: route に本文を渡すテスト用の関数
// seen: 診察開始の処理への入力。空の場合は未実行
const seen = await call({ appointmentId: id, … });
return seen.length === 0;` },
    },
    why: "`c.req.json()` の戻り値は `any` であるため、そのまま渡しても型検査は通ります。`any` の受け渡しを検査するルールと、不正な本文を渡すテストが検出します。",
  },
  {
    id: "B3-schema-without-uuid",
    kind: "bad",
    label: "UUID の検査を外す",
    baseCase: "G1-solution",
    target: "schema の部分",
    diff: [
      { kind: "skip", text: "// AppointmentId と VeterinarianId の import を消す" },
      { kind: "same", text: "const schema = z.object({" },
      { kind: "del", text: "  appointmentId: AppointmentId.schema," },
      { kind: "del", text: "  veterinarianId: VeterinarianId.schema," },
      { kind: "add", text: "  appointmentId: z.string().brand<\"AppointmentId\">()," },
      { kind: "add", text: "  veterinarianId: z.string().brand<\"VeterinarianId\">()," },
      { kind: "same", text: "}).readonly();" },
      { kind: "skip", text: "// 以降は同じ" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "エラーなし", setting: "// UUID の形は書き方に現れないので、どのルールも検出しません" },
      tests: { found: true, output: "2件失敗: Counterexample: [\"\"]" },
    },
    why: "UUID でなくても型は合い、書き方にも問題はありません。値を多数試すテストだけが検出します。",
  },
  {
    id: "B4-audit-owner-contact",
    kind: "bad",
    label: "監査記録に個人情報を含める",
    baseCase: "G4-audit-three-fields",
    target: "toAuditPayload の部分",
    diff: [
      { kind: "skip", text: "// import と ExaminationStartedAuditPayload の型は消す" },
      { kind: "del", text: "export const toAuditPayload = ({" },
      { kind: "skip", text: "  // appointmentId、veterinarianId、examinationStartedAt の分割代入を消す" },
      { kind: "del", text: "}: InExamination): ExaminationStartedAuditPayload => ({" },
      { kind: "add", text: "export const toAuditPayload = (appointment: InExamination) => ({" },
      { kind: "skip", text: "  // 3 項目は appointment から取る" },
      { kind: "add", text: "  ownerContact: clinicFixture.ownerContact," },
      { kind: "same", text: "});" },
    ],
    results: {
      types: { found: true, output: "TS2578: Unused '@ts-expect-error' directive." },
      lint: { found: false, output: "エラーなし", setting: "// 項目の追加は書き方に現れないので、どのルールも検出しません" },
      tests: { found: true, output: "1件失敗: Property failed after 1 tests", setting: "expect(toAuditPayload(appointment)).toEqual({ appointmentId: appointment.appointmentId, … });" },
    },
    why: "項目が増えると型エラーが消えて、`// @ts-expect-error` が未使用のまま残ります。値の性質のテストは余分な項目で失敗します。この表の Linter のルールは書き方の問題を検出しないため、このコードは通過します。",
  },
  {
    id: "G3-as-const",
    kind: "good",
    label: "as const を追加する（正しいコード）",
    baseCase: "G1-solution",
    target: "parse の部分",
    diff: [
      { kind: "same", text: "import { schemaResult } from \"../../../src/domain/shared/schemaResult.js\";" },
      { kind: "add", text: "const fieldNames = [\"appointmentId\", \"veterinarianId\"] as const;" },
      { kind: "skip", text: "// schema の定義は同じ" },
      { kind: "same", text: "export const StartExaminationInput = {" },
      { kind: "same", text: "  schema," },
      { kind: "add", text: "  fieldNames," },
      { kind: "same", text: "  parse: schemaResult(schema)," },
      { kind: "same", text: "} as const;" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "エラーなし", setting: `"@typescript-eslint/consistent-type-assertions":
  ["error", { assertionStyle: "never" }]` },
      tests: { found: false, output: "5件成功" },
    },
    why: "`as const` は値を変えず、型も偽らないため、`assertionStyle` を `\"never\"` にしてもルールは誤検知（正しいコードを誤った変更として検出すること）しません。",
  },
];

export const session03ChangeChecks: ChangeCheckSet = {
  example: "session-03-solution",
  ariaLabel: "誤った変更と3つの仕組みの結果",
  mechanisms,
  cases,
  note: "`any` や `as` の使用はルールと値の性質のテスト、UUID の検査の削除は値の性質のテストだけ、個人情報の追加は型のテストと値の性質のテストが検出します。演習の表では、検出できない仕組みは「対象外」と表示されます。",
};
