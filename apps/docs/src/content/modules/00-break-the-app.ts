import type { ModuleContent } from "../module-content";

export const breakTheAppModule: ModuleContent = {
  id: "00-break-the-app",
  slug: "00-break-the-app",
  label: "DOG",
  title: "導入事故を起こす",
  durationMinutes: 15,
  caseStudy: {
    animalName: "DOG",
    animalType: "dog",
    avatar: "🐕",
    context: "WAN NYAN CLINIC の予約・カルテシステムで再診対応を扱います。",
  },
  trigger: {
    kind: "incident",
    situation: "再診察を開始する要求へ既存コードで対応します。",
    incident: "会計済みの予約が診察中へ戻り、会計後の状態が壊れました。",
  },
  invariant: "Paid は終端状態で、診察中へ遷移しません。",
  mission: "通常テストが緑でも残る不正な遷移を事故テストで観察します。",
  technique: {
    name: "事故テストによる観察",
    reason: "型に表現されていない業務ルールを観察可能な失敗にします。",
    limits: "このモジュールでは原因を観察するだけで、状態モデルは修正しません。",
  },
  editTargets: [],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:00",
    expected: "Paid から InExamination へ戻れる事故が再現され、テストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example test",
    expected: "通常フローの11テストは成功したままです。",
  },
  filesToRead: [
    {
      file: "src/legacy/appointment.ts",
      focus: "LegacyAppointment.status、optional fields、bookAppointment、updateStatus を読みます。",
    },
    {
      file: "src/legacy/logger.ts",
      focus: "予約情報を丸ごとログへ渡したとき、隠したい情報がどう扱われるかを読みます。",
    },
    {
      file: "exercises/00-incident.test.ts",
      focus: "失敗する期待値が、どの業務ルールを表しているかを読みます。",
    },
  ],
  reviewPoints: ["Paid から戻れる経路と、状態ごとに必須な情報を列挙させる。"],
  doneWhen: ["壊れた遷移を再現し、型にない不変条件を説明できる。"],
  changeImpact: "次の状態モデリングで、Paid を終端状態として型に閉じる必要が明確になります。",
  reflectionQuestions: [
    "Paid が終端であるというルールは、現在の型と updateStatus のどこで失われていますか。",
  ],
  fallbackGuidance: "通常テストを先に実行し、次に事故テストと legacy/appointment.ts の updateStatus を読み合わせます。",
  workedExamples: [
    { file: "src/legacy/appointment.ts", symbols: ["bookAppointment", "updateStatus"] },
  ],
  resources: [],
  blocks: [
    {
      kind: "prose",
      heading: "今回の状況",
      paragraphs: [
        "ミケの飼い主から、皮膚の赤みが残っているため再診したいという連絡が入りました。",
        "スタッフは「再診察を開始できるようにしてほしい」と依頼しました。",
        "ところが、会計済みの来院まで診察中へ戻せることが分かりました。",
      ],
    },
    {
      kind: "prose",
      heading: "事故報告",
      paragraphs: [
        "会計済みの来院が診察中へ戻ると、会計後に確定した診断、処方、請求金額が「まだ診察中の記録」として扱われます。現場では、会計が終わった来院は閉じた記録であり、診察室に戻る操作は業務上存在しません。",
      ],
    },
    {
      kind: "checklist",
      heading: "ミッション",
      items: [
        "通常テストが緑で始まることを確認する。",
        "事故テストを実行し、業務上あり得ない遷移を再現する。",
        "なぜ型が止められないのかを legacy 実装から読む。",
        "次のセッションで守るべきルールを言葉にする。",
      ],
    },
    {
      kind: "prose",
      heading: "赤テストを見る",
      paragraphs: [
        "通常テストは緑のままです。exercise だけを実行し、仕様変更が既存の string status をすり抜けることを確認します。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:00",
      expected: "exercise:00 は失敗します。失敗していれば正しい状態です。Expected: paid / Received: in-examination",
    },
    {
      kind: "file-table",
      heading: "読むファイル",
      rows: [
        {
          file: "packages/clinic-example/src/legacy/appointment.ts",
          focus: "status: string と updateStatus がどこまでの遷移を許しているかを見る。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/legacy/logger.ts",
          focus: "予約情報を丸ごとログへ渡したとき、隠したい情報がどう扱われるかを見る。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/exercises/00-incident.test.ts",
          focus: "失敗する期待値が、どの業務ルールを表しているかを見る。",
          mode: "read",
        },
      ],
    },
    {
      kind: "checklist",
      heading: "観察すること",
      items: [
        "Paid は終端状態なのに、今の型にはその制約がない。",
        "状態ごとに必要な情報が optional field として広がっている。",
        "throw される失敗は、呼び出し側が型だけでは分岐できない。",
        "ログ出力で隠したい情報が、値の型だけでは守られていない。",
      ],
    },
    {
      kind: "prose",
      heading: "次のセッションへ",
      paragraphs: [
        "次は「キャンセル理由と再診希望日を残したい」という要求を読みます。どの状態にどの情報が必要なのかを整理し、状態ごとの形を TypeScript で表します。",
        "optional field、throw、丸ごとのログ出力も同じ根にあります。値の取り得る形が広すぎると、呼び出し側の判断も広がります。",
      ],
    },
  ],
};
