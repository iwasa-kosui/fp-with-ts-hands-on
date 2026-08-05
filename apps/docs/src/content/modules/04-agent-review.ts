import type { ModuleContent } from "../module-content";

export const agentReviewModule: ModuleContent = {
  id: "04-agent-review",
  slug: "04-agent-review",
  label: "TURTLE",
  title: "エージェントレビューを設計する",
  durationMinutes: 20,
  caseStudy: {
    animalName: "TURTLE",
    animalType: "turtle",
    avatar: "🐢",
    context: "カメの電話フォロー対象を、既存の設計判断を保って AI エージェントへ依頼します。",
  },
  trigger: {
    kind: "review",
    situation: "既存の設計判断を保ったまま、AI エージェントへ追加機能を依頼します。",
    reviewProblem: "実装だけを頼むと、終端状態、境界、PII、失敗型の前提が抜けます。",
  },
  invariant: "依頼文とレビューで、守る状態遷移・境界・失敗値・記録を明示する。",
  mission: "型とテストで検証できることと、人が要求から判断することを checklist と prompt に分けます。",
  technique: {
    name: "検証可能な依頼とレビュー観点",
    reason: "既存の設計判断を checklist と具体的な prompt に変換します。",
    limits: "型が通ることだけで要求適合性まで保証できるとは扱いません。",
  },
  editTargets: [
    { file: "src/clinic/agent-review.ts", symbol: "agentReviewChecklist" },
    { file: "src/clinic/agent-review.ts", symbol: "buildFollowUpAgentPrompt" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
    expected: "starter では checklist の観点または prompt の具体的な制約に関するテストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
    expected: "状態遷移、境界、Sensitive、Result、domain event を明示した依頼文を生成できてテストが成功します。",
  },
  filesToRead: [
    {
      file: "src/clinic/agent-review.ts",
      focus: "agentReviewChecklist の5観点と buildFollowUpAgentPrompt が、何を検証可能な依頼にしているか読みます。",
    },
    {
      file: "exercises/04-agent-review.test.ts",
      focus: "checklist の全観点と prompt に必須の表現を確認します。",
    },
  ],
  reviewPoints: [
    "型とテストで確認できる不正な組み合わせを確認する。",
    "人が要求から、終端状態、境界、PII、失敗型、変更記録を確認する。",
    "prompt の各制約が実装者の検証可能な行動として書かれているか確認する。",
  ],
  doneWhen: [
    "次の機能を依頼する際の、検証可能なレビュー観点を持てる。",
    "型とテストに任せる確認と、人が要求からレビューすべき確認を区別できる。",
  ],
  changeImpact: "次の追加要求で既存の不変条件を prompt に持ち込み、実装後に要求適合性を人が確認できます。",
  reflectionQuestions: [
    "型とテストに任せられる確認と、人が要求からレビューすべき確認はどこで分かれますか。",
  ],
  fallbackGuidance: "状態遷移、境界、Sensitive、Result、domain event の5項目を順に prompt へ入れ、検証可能な文になっているか確認します。",
  workedExamples: [
    { file: "src/clinic/agent-review.ts", symbols: ["agentReviewChecklist", "buildFollowUpAgentPrompt"] },
  ],
  resources: [],
  blocks: [
    {
      kind: "prose",
      heading: "依頼に入れる制約",
      paragraphs: [
        "AI エージェントには実装対象だけでなく、既存の状態遷移、unknown の parse、Sensitive、Result、domain event の制約も渡します。checklist は見落としを防ぎ、prompt は実装者が確認できる作業指示になります。",
        "型とテストは不正な組み合わせや既知の振る舞いを確かめます。一方で、人は追加要求が終端状態を戻していないか、PII の境界や記録の意味が要求に合うかをレビューします。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
      expected: "starter の依頼文または checklist の不足を確認します。この実装を読む環境では worked example があるため成功します。",
    },
    {
      kind: "file-table",
      heading: "読む場所と編集場所",
      rows: [
        {
          file: "packages/clinic-example/src/clinic/agent-review.ts",
          focus: "既存の設計判断を checklist と prompt へ対応付ける。",
          mode: "edit",
        },
      ],
    },
    {
      kind: "code",
      heading: "型と人のレビューを分ける",
      language: "text",
      code: "電話フォロー対象を抽出してください。\n- 型とテスト: Result の error.kind、既知の状態遷移を確認する\n- 人のレビュー: 要求が終端状態、境界、PII、変更記録の意味を壊していないか確認する\n- Sensitive を unwrap してログに出さない\n- 成功時だけ FollowUpRequested domain event を記録する",
    },
    {
      kind: "checklist",
      heading: "レビューすること",
      items: [
        "型とテストで、既知の不正な状態遷移と Result の失敗値を確認する。",
        "人が、追加要求に終端状態、境界、PII の前提漏れがないか確認する。",
        "人が、成功した変更だけを domain event として残す意味が要求に合うか確認する。",
      ],
    },
    {
      kind: "command",
      phase: "green",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:04",
      expected: "5つの横断観点を含む依頼文を生成できて exercise:04 が成功します。",
    },
  ],
};
