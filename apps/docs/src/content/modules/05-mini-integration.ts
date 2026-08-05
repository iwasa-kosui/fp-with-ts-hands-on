import type { ModuleContent } from "../module-content";

export const miniIntegrationModule: ModuleContent = {
  id: "05-mini-integration",
  slug: "05-mini-integration",
  label: "FOX",
  title: "ミニ総合演習",
  durationMinutes: 15,
  caseStudy: {
    animalName: "FOX",
    animalType: "fox",
    avatar: "🦊",
    context: "キツネの検査結果から、電話フォローが必要な患者だけを安全に抽出します。",
  },
  trigger: {
    kind: "new-requirement",
    situation: "これまでの設計判断を使って、小さな追加機能へ対応します。",
    requirement: "検査後に電話フォローが必要な患者を抽出します。",
  },
  invariant: "既存の状態、境界、Result、event の設計を崩さず、1関数で要求を受け止めます。",
  mission: "電話フォロー要求の問題を見つけ、既習技法を選び、1関数だけを変更して、その効果をテストで確認します。",
  technique: {
    name: "既習技法の統合",
    reason: "状態、入力境界、Sensitive、Result、domain event の判断を1つの use case で接続します。",
    limits: "新しい抽象化や型テクニックは追加しません。",
  },
  editTargets: [
    { file: "src/clinic/use-cases.ts", symbol: "collectFollowUpTargets" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
    expected: "starter では対象患者の抽出、petId mismatch、PII、Result、domain event のいずれかのテストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
    expected: "対象患者だけを安全に抽出し、petId mismatch、PII、Result、domain event のテストが成功します。",
  },
  filesToRead: [
    {
      file: "src/clinic/use-cases.ts",
      focus: "collectFollowUpTargets と、状態、入力境界、Sensitive、Result、domain event の既存設計を読みます。",
    },
    {
      file: "exercises/05-follow-up.test.ts",
      focus: "電話フォロー対象、petId mismatch、PII、Result、domain event の期待値を確認します。",
    },
  ],
  reviewPoints: [
    "Paid かつ needsFollowUp の患者だけが抽出対象か確認する。",
    "検査結果の petId mismatch が Result error になり、event を残さないか確認する。",
    "ownerPhone が Sensitive のまま扱われ、JSON へ PII が露出しないか確認する。",
    "成功した対象だけ FollowUpRequested domain event が記録されるか確認する。",
  ],
  doneWhen: [
    "追加要求を既存の設計判断へ対応付けて、collectFollowUpTargets だけを安全に変更できる。",
    "問題の発見、手段の選択、局所的な変更、効果の確認を一巡して説明できる。",
  ],
  changeImpact: "電話フォロー一覧を追加しても、終端状態、入力境界、PII、失敗値、変更記録の既存設計を維持できます。",
  reflectionQuestions: [
    "電話フォロー要求の各制約は、型、境界、Result、event、レビューのどこで守られていますか。",
  ],
  fallbackGuidance: "collectFollowUpTargets の対象判定を一つずつ確認します。時間が足りない場合は worked example に切り替え、petId mismatch、PII、Result、event を確認します。",
  workedExamples: [
    { file: "src/clinic/use-cases.ts", symbols: ["collectFollowUpTargets"] },
  ],
  resources: [
    { label: "ドメインイベントを容易に記録する設計", href: "https://kosui.me/posts/2025/05/06/142842" },
  ],
  blocks: [
    {
      kind: "prose",
      heading: "複数の判断軸を一周する",
      paragraphs: [
        "新しい技法は増やしません。これまでに閉じた不変条件を壊さず、電話フォローという運用上の要求を既存の型へ載せます。",
        "検査結果と予約の petId、診療状態、needsFollowUp を順に確認し、PII は Sensitive のまま返します。失敗は Result、成功した変更は domain event で表します。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
      expected: "starter で、電話フォロー要求のどの制約が失敗しているかを確認します。この実装を読む環境では worked example があるため成功します。",
    },
    {
      kind: "file-table",
      heading: "読む場所と編集場所",
      rows: [
        {
          file: "packages/clinic-example/exercises/05-follow-up.test.ts",
          focus: "対象患者、petId mismatch、PII、Result、domain event の期待値を読む。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/use-cases.ts",
          focus: "collectFollowUpTargets だけを編集し、既存の設計判断を接続する。",
          mode: "edit",
        },
      ],
    },
    {
      kind: "checklist",
      heading: "統合ループ",
      items: [
        "問題を発見する: テストから、対象判定、petId mismatch、PII、Result、event の不足を特定する。",
        "手段を選ぶ: 既存の状態、入力境界、Sensitive、Result、domain event の役割へ対応付ける。",
        "局所的に変更する: collectFollowUpTargets の1関数だけを編集する。",
        "効果を確認する: exercise:05 を再実行し、守れるようになった制約を確認する。",
      ],
    },
    {
      kind: "prose",
      heading: "まとめ",
      paragraphs: [
        "設計は将来の要求を予言するためではなく、次の変更で確認すべき場所を少なくするためにあります。",
      ],
    },
    {
      kind: "command",
      phase: "green",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
      expected: "対象患者、petId mismatch、PII、Result、domain event の全テストが成功します。",
    },
  ],
  finalActionPlan: {
    implementationPrompt: "自分の業務コードで最初に見直す実装箇所を書いてください。",
    firstActionPrompt: "その箇所で最初に試す行動を書いてください。",
  },
};
