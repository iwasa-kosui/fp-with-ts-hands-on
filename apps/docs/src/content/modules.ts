export type SourceLink = Readonly<{
  label: string;
  href: string;
}>;

export type ContentSection = Readonly<{
  heading: string;
  body: string;
  code?: Readonly<{
    language: string;
    value: string;
  }>;
}>;

export type ModuleContent = Readonly<{
  id: string;
  animal: "dog" | "cat" | "rabbit" | "bird" | "hamster" | "turtle" | "fox";
  animalLabel: string;
  minutes: number;
  title: string;
  newRequest: string;
  incident: string;
  invariant: string;
  redCommand: string;
  editTarget: string;
  greenCommand: string;
  agentReview: string;
  doneWhen: string;
  sourceLinks: readonly SourceLink[];
  sections: readonly ContentSection[];
}>;

const noSources: readonly SourceLink[] = [];

export const modules: readonly ModuleContent[] = [
  {
    id: "00-break-the-app",
    animal: "dog",
    animalLabel: "DOG",
    minutes: 15,
    title: "導入事故を起こす",
    newRequest: "再診察を開始できるようにしてほしい。",
    incident: "会計済みの予約が診察中へ戻り、会計後の状態が壊れた。",
    invariant: "Paid は終端状態であり、診察中へ遷移しない。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:00",
    editTarget: "まずは legacy の status: string と updateStatus を読み、何も直さない。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example test",
    agentReview: "Paid から戻れる経路と、状態ごとに必須な情報を列挙させる。",
    doneWhen: "壊れた遷移を再現し、型にない不変条件を説明できる。",
    sourceLinks: noSources,
    sections: [
      {
        heading: "赤テストを見る",
        body: "通常テストは緑のままです。exercise だけを実行し、仕様変更が既存の string status をすり抜けることを確認します。",
        code: { language: "shell", value: "pnpm --filter @fp-with-ts/clinic-example exercise:00" },
      },
      {
        heading: "観察すること",
        body: "optional field、throw、丸ごとのログ出力も同じ根にあります。値の取り得る形が広すぎると、呼び出し側の判断も広がります。",
      },
    ],
  },
  {
    id: "00-read-the-incident",
    animal: "cat",
    animalLabel: "CAT",
    minutes: 15,
    title: "事故報告を読む",
    newRequest: "キャンセル理由と再診希望日を残したい。",
    incident: "status だけでは、キャンセルされた理由も次の対応も分からない。",
    invariant: "Canceled は reason を持ち、再診希望はキャンセル時だけに存在する。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    editTarget: "src/legacy/appointment.ts と exercise の期待値を読む。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example test",
    agentReview: "状態ごとの必須プロパティを表にし、optional で逃がしていないか確認する。",
    doneWhen: "次の要求を状態の種類ごとの情報として言い換えられる。",
    sourceLinks: noSources,
    sections: [
      {
        heading: "要求を分解する",
        body: "キャンセル理由と再診希望日は、どの予約にも付ける属性ではありません。Canceled という状態にだけ必要なデータです。",
      },
      {
        heading: "次の編集の準備",
        body: "この実装には worked example が含まれるため exercise:01 は緑になります。当日の starter 差分では、同じ command を赤テストとして使い、状態とデータを同時に閉じる準備をします。",
      },
    ],
  },
  {
    id: "01-state-modeling",
    animal: "rabbit",
    animalLabel: "RABBIT",
    minutes: 30,
    title: "状態遷移を型にする",
    newRequest: "キャンセル理由と再診希望を、間違った状態に付けられないようにする。",
    incident: "Paid から診察開始でき、Canceled に理由がない予約も作れてしまう。",
    invariant: "Scheduled -> CheckedIn -> InExamination -> Paid だけを許可し、Paid と Canceled は終端にする。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    editTarget: "Appointment.startExamination と Appointment.cancelWithReason の2関数。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    agentReview: "kind の網羅性、終端状態の扱い、@ts-expect-error の型テストを確認する。",
    doneWhen: "不正な遷移が型または Result のどちらで止まるか説明できる。",
    sourceLinks: noSources,
    sections: [
      {
        heading: "編集する関数",
        body: "この実装には解答済みの関数が含まれるため exercise:01 は緑になります。starter では、状態を文字列で上書きせず、現在の kind を見て次の状態の値を返す編集を行います。",
        code: {
          language: "typescript",
          value: "type Appointment =\n  | Readonly<{ kind: \"Scheduled\"; id: AppointmentId }>\n  | Readonly<{ kind: \"CheckedIn\"; id: AppointmentId }>\n  | Readonly<{ kind: \"InExamination\"; id: AppointmentId }>\n  | Readonly<{ kind: \"Paid\"; id: AppointmentId }>\n  | Readonly<{ kind: \"Canceled\"; id: AppointmentId; reason: string }>;",
        },
      },
      {
        heading: "型テスト",
        body: "@ts-expect-error は実行時テストではなく、コンパイラが誤りを見つけ続けることを確認するテストです。",
      },
    ],
  },
  {
    id: "02-boundary-and-ids",
    animal: "bird",
    animalLabel: "BIRD",
    minutes: 25,
    title: "境界と ID を守る",
    newRequest: "外部検査結果を取り込み、飼い主へ連絡できるようにする。",
    incident: "外部 payload の petId と ownerId を取り違え、連絡先がログへ出た。",
    invariant: "unknown は parse してから使い、ID は用途をまたがず、PII は文字列化しても伏せる。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
    editTarget: "PetId.safeParse、検査 result payload の parse、Sensitive.of の利用箇所。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:02",
    agentReview: "as で payload を通していないか、ID の取り違えが型エラーか、ログが redacted か確認する。",
    doneWhen: "入力境界、ID、runtime PII 防御の役割を分けて説明できる。",
    sourceLinks: [
      { label: "PII ログ漏洩を防止する", href: "https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense" },
    ],
    sections: [
      {
        heading: "外部入力を境界で止める",
        body: "この実装には解答済みの境界処理が含まれるため exercise:02 は緑になります。starter では、ネットワークから届く unknown を Zod の safeParse で検査してから domain の値へ変換します。",
        code: { language: "typescript", value: "const parsed = ExamResultPayload.safeParse(input);\nif (!parsed.success) return Result.err({ kind: \"ValidationError\" });" },
      },
      {
        heading: "PII は実行時にも守る",
        body: "Branded Type は ID の取り違えを防げますが、ログ出力までは防げません。Sensitive wrapper は JSON.stringify の結果を [REDACTED] にします。",
      },
    ],
  },
  {
    id: "03-result-errors",
    animal: "hamster",
    animalLabel: "HAMSTER",
    minutes: 30,
    title: "失敗理由と変更記録を返す",
    newRequest: "診察開始に失敗した理由を UI に表示し、成功した開始だけを追跡したい。",
    incident: "失敗が throw や undefined に混ざり、成功していない操作の記録まで残る。",
    invariant: "失敗は Result の kind で返し、ExaminationStarted は成功時だけ記録する。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
    editTarget: "startExamination use case と domain event store の成功経路。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
    agentReview: "error kind を網羅しているか、失敗時に event が記録されないか確認する。",
    doneWhen: "UI が分岐できる失敗値と、成功した変更記録を区別できる。",
    sourceLinks: [
      { label: "ドメインイベントを容易に記録する設計", href: "https://kosui.me/posts/2025/05/06/142842" },
    ],
    sections: [
      {
        heading: "失敗を値として読む",
        body: "この実装には解答済みの use case が含まれるため exercise:03 は緑になります。starter では、呼び出し元が try/catch ではなく error.kind を見て表示を決められるようにします。",
        code: { language: "typescript", value: "type StartError =\n  | Readonly<{ kind: \"AppointmentNotFound\" }>\n  | Readonly<{ kind: \"InvalidAppointmentState\" }>\n  | Readonly<{ kind: \"ValidationError\" }>;" },
      },
      {
        heading: "成功を記録する",
        body: "event sourcing は扱いません。ここでの event は、事故調査で診察開始を後から追うための小さな変更記録です。",
      },
    ],
  },
  {
    id: "04-agent-review",
    animal: "turtle",
    animalLabel: "TURTLE",
    minutes: 20,
    title: "エージェントレビューを設計する",
    newRequest: "電話フォロー対象の抽出を AI エージェントへ依頼したい。",
    incident: "実装だけを頼むと、終端状態、境界、PII、失敗型の前提が抜ける。",
    invariant: "依頼文とレビューで、守る状態遷移・境界・失敗値・記録を明示する。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example typecheck",
    editTarget: "レビュー checklist と次の変更依頼の prompt。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example test",
    agentReview: "不変条件、unknown の parse、Sensitive、Result、event を横断して確認する。",
    doneWhen: "次の機能を依頼する際の、検証可能なレビュー観点を持てる。",
    sourceLinks: noSources,
    sections: [
      {
        heading: "依頼に入れる制約",
        body: "対象関数、保持する不変条件、入力境界、返すエラー union、追加すべきテストを具体的に渡します。",
        code: { language: "text", value: "電話フォロー対象を抽出してください。\n- Paid / Canceled を戻さない\n- Sensitive をログへ unwrap しない\n- 失敗は Result で返す\n- 既存の event 記録規約を保つ\n- 追加した不変条件をテストする" },
      },
      {
        heading: "人間が見る点",
        body: "型が通っても、要求を満たすかは別です。仕様から外れた便利な抽象化や、境界を越える変換をレビューします。",
      },
    ],
  },
  {
    id: "05-mini-integration",
    animal: "fox",
    animalLabel: "FOX",
    minutes: 15,
    title: "ミニ総合演習",
    newRequest: "検査後に電話フォローが必要な患者を抽出する。",
    incident: "新しい一覧が、終端状態を戻したり PII をログに出したりする入口になり得る。",
    invariant: "既存の状態、境界、Result、event の設計を崩さず、1関数で要求を受け止める。",
    redCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
    editTarget: "電話フォロー対象を抽出する1関数。",
    greenCommand: "pnpm --filter @fp-with-ts/clinic-example exercise:05",
    agentReview: "抽出対象の状態、PII の扱い、失敗値、必要な変更記録を最終確認する。",
    doneWhen: "追加要求を既存の設計判断へ対応付けて、1関数を安全に変更できる。",
    sourceLinks: [
      { label: "ドメインイベントを容易に記録する設計", href: "https://kosui.me/posts/2025/05/06/142842" },
    ],
    sections: [
      {
        heading: "複数の判断軸を一周する",
        body: "新しい技法は増やしません。これまでに閉じた不変条件を壊さず、電話フォローという運用上の要求を既存の型へ載せます。",
      },
      {
        heading: "まとめ",
        body: "設計は将来の要求を予言するためではなく、次の変更で確認すべき場所を少なくするためにあります。",
      },
    ],
  },
];

export const moduleById = (id: string): ModuleContent | undefined =>
  modules.find((module) => module.id === id);
