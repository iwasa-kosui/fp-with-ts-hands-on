import type { ModuleContent } from "../module-content";

export const boundaryAndIdsModule: ModuleContent = {
  id: "02-boundary-and-ids",
  slug: "02-boundary-and-ids",
  label: "BIRD",
  title: "境界と ID を守る",
  durationMinutes: 25,
  caseStudy: {
    animalName: "BIRD",
    animalType: "bird",
    avatar: "🐦",
    context: "鳥の外部検査結果と飼い主の連絡先を、安全な境界で扱います。",
  },
  trigger: {
    kind: "incident",
    situation: "外部サービスから届く検査結果を取り込み、飼い主へ連絡します。",
    incident: "外部 payload の petId と ownerId を取り違え、連絡先がログへ出ました。",
  },
  invariant: "unknown は parse してから使い、ID は用途をまたがず、PII は文字列化しても伏せる。",
  mission: "外部入力、用途別 ID、PII の境界をそれぞれ異なる仕組みで守ります。",
  technique: {
    name: "Zod、Branded Type、Sensitive",
    reason: "Zod で unknown を検証し、Branded Type で ID の取り違えを防ぎ、Sensitive で PII の実行時出力を伏せます。",
    limits: "Branded Type だけではログ漏えいを防げず、Sensitive だけでは入力妥当性を保証できません。",
  },
  editTargets: [
    { file: "src/clinic/exam-result.ts", symbol: "ExamResult.safeParse" },
    { file: "src/clinic/owner-contact.ts", symbol: "OwnerContact.safeParse" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
    expected: "starter では unknown の検証、ID の変換、PII の伏せ字のいずれかに関するテストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
    expected: "外部検査 payload を検証でき、連絡先を JSON.stringify しても [REDACTED] だけが出力されます。",
  },
  filesToRead: [
    {
      file: "src/clinic/pet-id.ts",
      focus: "PetId.safeParse と PetId.schema を worked example として読み、用途別 ID の変換境界を確認します。",
    },
    {
      file: "src/shared/sensitive.ts",
      focus: "Sensitive.of、toJSON、toString を worked example として読み、PII が実行時に伏せられる理由を確認します。",
    },
    {
      file: "exercises/02-boundary-and-ids.test.ts",
      focus: "unknown payload の検証と JSON.stringify による [REDACTED] の期待値を確認します。",
    },
  ],
  reviewPoints: [
    "payload を as で通さず unknown から safeParse しているか確認する。",
    "petId と ownerId の取り違えが型エラーになるか確認する。",
    "Sensitive を JSON.stringify しても値が [REDACTED] になるか確認する。",
  ],
  doneWhen: [
    "入力境界、ID、runtime PII 防御の役割を分けて説明できる。",
    "外部の unknown を domain の値にする順序を説明できる。",
  ],
  changeImpact: "検査結果と連絡先を受け取る後続の use case が、検証済みの ID と伏せられる PII だけを受け取れます。",
  reflectionQuestions: [
    "Zod、Branded Type、Sensitive は、それぞれどの境界と事故を担当していますか。",
  ],
  fallbackGuidance: "payload を unknown に戻し、parse、ID 変換、Sensitive 変換の順に確認します。最後に JSON.stringify の結果が [REDACTED] か確認します。",
  workedExamples: [
    { file: "src/clinic/exam-result.ts", symbols: ["ExamResult.safeParse"] },
    { file: "src/clinic/owner-contact.ts", symbols: ["OwnerContact.safeParse"] },
    { file: "src/clinic/pet-id.ts", symbols: ["PetId.safeParse", "PetId.schema"] },
    { file: "src/shared/sensitive.ts", symbols: ["Sensitive.of", "toJSON", "toString"] },
  ],
  resources: [
    { label: "PII ログ漏洩を防止する", href: "https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense" },
  ],
  blocks: [
    {
      kind: "prose",
      heading: "事故を境界ごとに分ける",
      paragraphs: [
        "外部 payload は TypeScript の型を持たない unknown です。検証前に domain の値として使うと、petId と ownerId のような異なる ID を取り違える入口になります。",
        "さらに、正しい ID を持っていても、飼い主の連絡先を文字列化すれば PII は漏えいします。入力の妥当性と出力の秘匿は別々に守ります。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
      expected: "starter の境界保護が不足していることを確認します。この実装を読む環境では worked example があるため成功します。",
    },
    {
      kind: "file-table",
      heading: "読む場所と編集場所",
      rows: [
        {
          file: "packages/clinic-example/src/clinic/pet-id.ts",
          focus: "PetId.safeParse と PetId.schema を読み、petId の入力境界を確認する。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/shared/sensitive.ts",
          focus: "Sensitive.of、toJSON、toString を読み、PII が [REDACTED] になる経路を確認する。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/exam-result.ts",
          focus: "unknown の検査 result payload を safeParse する。",
          mode: "edit",
        },
        {
          file: "packages/clinic-example/src/clinic/owner-contact.ts",
          focus: "連絡先を safeParse し、Sensitive へ変換する。",
          mode: "edit",
        },
      ],
    },
    {
      kind: "code",
      heading: "unknown を検証してから使う",
      language: "typescript",
      code: "const parsed = ExamResultPayload.safeParse(input);\nif (!parsed.success) return Result.err({ kind: \"ValidationError\" });",
    },
    {
      kind: "checklist",
      heading: "レビューすること",
      items: [
        "payload を unknown から parse している。",
        "用途の異なる ID を as で取り違えていない。",
        "PII を JSON.stringify しても [REDACTED] 以外が出ない。",
      ],
    },
    {
      kind: "command",
      phase: "green",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
      expected: "外部検査 payload を検証し、連絡先をログで伏せられて exercise:02 が成功します。",
    },
  ],
};
