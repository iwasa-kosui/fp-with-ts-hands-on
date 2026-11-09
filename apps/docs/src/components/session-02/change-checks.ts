export type DiffLine = Readonly<{ kind: "same" | "del" | "add" | "skip"; text: string }>;
export type Mechanism = "types" | "lint" | "tests";
export type Outcome = Readonly<{ found: boolean; output: string }>;
export type ChangeCase = Readonly<{
  id: string;
  kind: "bad" | "good";
  label: string;
  diff: readonly DiffLine[];
  results: Readonly<Record<Mechanism, Outcome>>;
  why: string;
}>;

export const mechanisms: readonly Readonly<{ id: Mechanism; name: string; detail: string; code: string }>[] = [
  {
    id: "types",
    name: "型検査",
    detail: "tsc と、知らない状態を渡す型のテスト",
    code: `// @ts-expect-error
toStatusLabel({ kind: "NoSuchState" });`,
  },
  {
    id: "lint",
    name: "Linter の規則",
    detail: "default があっても候補を数える",
    code: `"@typescript-eslint/switch-exhaustiveness-check"
{ considerDefaultExhaustiveForUnions: false }`,
  },
  {
    id: "tests",
    name: "テスト",
    detail: "値を渡して表示名を見る",
    code: `// 6つの状態をそれぞれ渡す
expect(toStatusLabel({ kind } as never)).toBe(label);`,
  },
];

// results は exercise-guard の模範解答の仕組みを各ケースに実行した実際の出力です。
export const changeCases: readonly ChangeCase[] = [
  {
    id: "B2-missing-case-default",
    kind: "bad",
    label: "Paid を消し、default を「不明」に戻す",
    diff: [
      { kind: "same", text: "export const toStatusLabel = (appointment: Appointment): string => {" },
      { kind: "same", text: "  switch (appointment.kind) {" },
      { kind: "skip", text: "    // Scheduled から AwaitingPayment までの case は同じ" },
      { kind: "del", text: '    case "Paid":' },
      { kind: "del", text: '      return "会計済み";' },
      { kind: "same", text: '    case "Canceled":' },
      { kind: "same", text: '      return "キャンセル";' },
      { kind: "same", text: "    default:" },
      { kind: "del", text: "      return assertNever(appointment);" },
      { kind: "add", text: '      return "不明";' },
      { kind: "same", text: "  }" },
      { kind: "same", text: "};" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: `Switch is not exhaustive. Cases not matched: "Paid"` },
      tests: { found: true, output: `Paid: expected '不明' to be '会計済み'` },
    },
    why: "型検査は、「不明」を返す default を正しいコードとして通します。case を数える規則と、Paid を渡すテストが見つけます。",
  },
  {
    id: "B1-missing-case-assert-never",
    kind: "bad",
    label: "Paid を消し、assertNever は残す",
    diff: [
      { kind: "same", text: "export const toStatusLabel = (appointment: Appointment): string => {" },
      { kind: "same", text: "  switch (appointment.kind) {" },
      { kind: "skip", text: "    // Scheduled から AwaitingPayment までの case は同じ" },
      { kind: "del", text: '    case "Paid":' },
      { kind: "del", text: '      return "会計済み";' },
      { kind: "same", text: '    case "Canceled":' },
      { kind: "same", text: '      return "キャンセル";' },
      { kind: "same", text: "    default:" },
      { kind: "same", text: "      return assertNever(appointment);" },
      { kind: "same", text: "  }" },
      { kind: "same", text: "};" },
    ],
    results: {
      types: {
        found: true,
        output: `TS2345: …"Paid"… is not assignable to … 'never'.`,
      },
      lint: { found: true, output: `Switch is not exhaustive. Cases not matched: "Paid"` },
      tests: { found: true, output: `Paid: Unknown appointment status: {"kind":"Paid"}` },
    },
    why: "assertNever が残っているので、Paid が足りないことを型検査が見つけます。Linter の規則とテストも見つけます。次の演習の表では、この型エラーは自分で足した仕組みの結果ではないので「対象外」と出ます。",
  },
  {
    id: "B3-added-state-default",
    kind: "bad",
    label: "NoShow を足し、表示名を書かない",
    diff: [
      { kind: "add", text: "type NoShow = Readonly<{" },
      { kind: "add", text: '  kind: "NoShow";' },
      { kind: "skip", text: "  // appointmentId などのフィールド" },
      { kind: "add", text: "}>;" },
      { kind: "del", text: "export const toStatusLabel = (appointment: Appointment): string => {" },
      { kind: "add", text: "export const toStatusLabel = (appointment: Appointment | NoShow): string => {" },
      { kind: "same", text: "  switch (appointment.kind) {" },
      { kind: "skip", text: "    // 6つの case は同じ" },
      { kind: "same", text: "    default:" },
      { kind: "del", text: "      return assertNever(appointment);" },
      { kind: "add", text: '      return "不明";' },
      { kind: "same", text: "  }" },
      { kind: "same", text: "};" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: true, output: `Switch is not exhaustive. Cases not matched: "NoShow"` },
      tests: { found: false, output: "6件すべて成功" },
    },
    why: "テストは6つの状態しか渡さないので、NoShow の漏れに気づきません。union の候補を数える規則だけが見つけます。",
  },
  {
    id: "B4-string-kind",
    kind: "bad",
    label: "kind を string に戻す",
    diff: [
      { kind: "del", text: "export const toStatusLabel = (appointment: Appointment): string => {" },
      { kind: "add", text: "export const toStatusLabel = (appointment: Readonly<{ kind: string }>): string => {" },
      { kind: "same", text: "  switch (appointment.kind) {" },
      { kind: "skip", text: "    // 6つの case は同じ" },
      { kind: "same", text: "    default:" },
      { kind: "del", text: "      return assertNever(appointment);" },
      { kind: "add", text: '      return "不明";' },
      { kind: "same", text: "  }" },
      { kind: "same", text: "};" },
    ],
    results: {
      types: { found: true, output: "TS2578: Unused '@ts-expect-error' directive." },
      lint: { found: false, output: "指摘なし" },
      tests: { found: false, output: "6件すべて成功" },
    },
    why: "kind が string になると union ではないので、規則は候補を数えません。6つの状態を渡すテストも通ります。// @ts-expect-error は次の行が型エラーになることを確かめる印です。知らない状態を渡せるようになると型エラーが消えるので、TS2578 が出ます。",
  },
  {
    id: "B6-if-chain",
    kind: "bad",
    label: "switch を if に変え、Paid が抜ける",
    diff: [
      { kind: "same", text: "export const toStatusLabel = (appointment: Appointment): string => {" },
      { kind: "del", text: "  switch (appointment.kind) {" },
      { kind: "skip", text: "    // case と default をすべて消す" },
      { kind: "del", text: "  }" },
      { kind: "add", text: '  if (appointment.kind === "Scheduled") {' },
      { kind: "add", text: '    return "予約済み";' },
      { kind: "add", text: "  }" },
      { kind: "skip", text: "  // CheckedIn, InExamination, AwaitingPayment も同じ形（Paid の if はない）" },
      { kind: "add", text: '  if (appointment.kind === "Canceled") {' },
      { kind: "add", text: '    return "キャンセル";' },
      { kind: "add", text: "  }" },
      { kind: "add", text: '  return "不明";' },
      { kind: "same", text: "};" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "指摘なし" },
      tests: { found: true, output: `Paid: expected '不明' to be '会計済み'` },
    },
    why: "switch がなくなると規則は働かず、型検査も通ります。値を渡して結果を見るテストだけが見つけます。",
  },
  {
    id: "G3-open-string-default",
    kind: "good",
    label: "正しいコード: string の switch に default",
    diff: [
      { kind: "skip", text: "// toStatusLabel は元のコードのまま" },
      { kind: "add", text: "export const toVisitReasonLabel = (reason: string): string => {" },
      { kind: "add", text: "  switch (reason) {" },
      { kind: "add", text: '    case "vaccination":' },
      { kind: "add", text: '      return "ワクチン接種";' },
      { kind: "add", text: "    default:" },
      { kind: "add", text: '      return "その他";' },
      { kind: "add", text: "  }" },
      { kind: "add", text: "};" },
    ],
    results: {
      types: { found: false, output: "エラーなし" },
      lint: { found: false, output: "指摘なし" },
      tests: { found: false, output: "6件すべて成功" },
    },
    why: "string は候補を数え切れないので、この default は正しいコードです。ここで指摘が出たら誤検知です。",
  },
];

export const verdictOf = (
  changeCase: ChangeCase,
  mechanism: Mechanism,
): Readonly<{ tone: "positive" | "negative"; text: string }> => {
  if (changeCase.results[mechanism].found) return { tone: "positive", text: "✓ 検出" };
  return changeCase.kind === "bad"
    ? { tone: "negative", text: "▲ すり抜け" }
    : { tone: "positive", text: "✓ 誤検知なし" };
};
