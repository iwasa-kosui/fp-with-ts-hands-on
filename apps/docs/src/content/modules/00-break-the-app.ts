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
  introBlocks: [
    {
      kind: "overview",
      heading: "この開発に参加するあなたへ",
      introduction:
        "完成形を一度に作るのではなく、業務事故から守るべきルールを見つけ、小さな改善と確認を繰り返します。まず、誰のどんな困りごとを守るのかを確かめます。",
      items: [
        {
          title: "あなたの役割",
          description:
            "TypeScript 開発者として、利用者の困りごとと、それを守る業務ルールの対応を確かめます。",
        },
        {
          title: "進め方",
          description: "事故を観察し、守るべきルールを型に近づけ、確認を重ねます。",
        },
      ],
    },
    {
      kind: "overview",
      heading: "1回の来院で起きること",
      introduction:
        "飼い主と病院スタッフは、来院の前後で次の仕事をつなげます。ここでは、業務の体験を状態値より先に確認します。",
      items: [
        {
          title: "予約",
          description: "飼い主が来院の予定を伝え、病院が受け入れる準備をします。",
        },
        {
          title: "受付",
          description: "来院した飼い主と動物を確認し、診療につなげます。",
        },
        {
          title: "診察と記録",
          description: "獣医師が診察し、診療の内容を一貫した記録として残します。",
        },
        {
          title: "会計と完了",
          description: "確定した診療内容をもとに会計し、来院の記録を完了させます。",
        },
        {
          title: "再診",
          description: "飼い主からの相談を受け、次に必要な連絡を病院内で引き継ぎます。",
        },
      ],
    },
    {
      kind: "value-map",
      heading: "機能が届ける価値",
      introduction:
        "各機能が、誰にどんな価値を届けるかを確認します。",
      rows: [
        {
          function: "予約・受付",
          audiences: "受付スタッフ、飼い主",
          value: "来院を迷わず正しく受け入れられる。",
        },
        {
          function: "診察・カルテ",
          audiences: "獣医師、病院スタッフ",
          value: "診療の記録を一貫して扱える。",
        },
        {
          function: "会計",
          audiences: "会計担当、飼い主",
          value: "確定した来院記録と会計を誤って壊さない。",
        },
        {
          function: "フォロー・連絡先・申し送り",
          audiences: "病院スタッフ、飼い主",
          value: "必要な連絡を安全に引き継げる。",
        },
      ],
    },
    {
      kind: "overview",
      heading: "アプリは業務をどう表すか",
      introduction:
        "アプリでは、来院の進み具合を状態値で表します。業務で守るルールを、扱える状態の範囲に反映させます。",
      items: [
        {
          title: "状態の対応",
          description:
            "予約済み: scheduled、受付済み: checked-in、診察中: in-examination、会計済み・来院完了: paid と表します。",
        },
        {
          title: "今回守ること",
          description:
            "今回の演習では、paid の来院を診察中へ戻さないことを守ります。再診の正規操作は今回の演習の対象外です。",
        },
      ],
    },
    {
      kind: "overview",
      heading: "開発者として今日行うこと",
      introduction:
        "packages/clinic-example の TypeScript コードを読み、守る価値を壊さない設計へ進む準備をします。",
      items: [
        {
          title: "読む場所",
          description:
            "src/legacy で現在の実装を読み、exercises で事故を観察し、test で既存の振る舞いを確認します。",
        },
        {
          title: "これから作る設計",
          description:
            "src/clinic に設計を置き、事故報告、状態モデリング、境界とID、Result、Agent Review を通じて守る価値につなげます。",
        },
      ],
    },
  ],
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
      kind: "prose",
      heading: "赤テストを見る",
      paragraphs: [
        "通常テストは緑のままです。exercise だけを実行し、仕様変更が既存の string status をすり抜けることを確認します。",
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
