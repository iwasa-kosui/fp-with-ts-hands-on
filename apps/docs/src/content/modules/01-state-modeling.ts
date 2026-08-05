import type { ModuleContent } from "../module-content";

export const stateModelingModule: ModuleContent = {
  id: "01-state-modeling",
  slug: "01-state-modeling",
  label: "RABBIT",
  title: "状態遷移を型にする",
  durationMinutes: 30,
  caseStudy: {
    animalName: "RABBIT",
    animalType: "rabbit",
    avatar: "🐇",
    context: "うさぎの予約で、キャンセル後の再診希望を安全に扱います。",
  },
  trigger: {
    kind: "new-requirement",
    situation: "予約の状態と、キャンセル後に必要な業務情報を見直します。",
    requirement: "キャンセル理由と再診希望を、間違った状態に付けられないようにする。",
  },
  invariant: "Scheduled -> CheckedIn -> InExamination -> Paid の進行を許可し、Scheduled または CheckedIn から Canceled へキャンセルできる。Paid と Canceled は終端にする。",
  mission: "状態ごとのデータを union に閉じ、2つの遷移関数だけで要求を受け止めます。",
  technique: {
    name: "Discriminated Union",
    reason: "kind ごとに必要なデータを型で分け、不正な状態と属性の組み合わせを表現できなくします。",
    limits: "外部の unknown 入力の検証と PII の実行時保護は、この型だけでは担保できません。",
  },
  editTargets: [
    { file: "src/clinic/appointment.ts", symbol: "Appointment.startExamination" },
    { file: "src/clinic/appointment.ts", symbol: "Appointment.cancelWithReason" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "starter では不正な状態遷移、または Canceled の reason・canceledAt・任意の再診希望に関するテストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "CheckedIn からだけ診察を開始でき、Scheduled または CheckedIn からの Canceled には理由、キャンセル時刻、任意の再診希望が記録されてテストが成功します。",
  },
  filesToRead: [
    {
      file: "src/clinic/appointment.ts",
      focus: "Appointment union、book、checkIn、recordPayment、isTerminal を読むだけにし、各 kind の情報と終端状態を確認します。",
    },
    {
      file: "exercises/01-state-modeling.test.ts",
      focus: "診察開始と理由付きキャンセルという実行時要件を期待値から確認します。",
    },
    {
      file: "test/01-state-modeling.test.ts",
      focus: "@ts-expect-error で Paid からの再診察・キャンセルと未知のキャンセル理由がコンパイル時に拒否されることを確認します。",
    },
  ],
  reviewPoints: [
    "kind の分岐が CheckedIn 以外からの診察開始を許していないか確認する。",
    "Canceled にだけ reason、canceledAt、任意の followUpRequestedAt が存在するか確認する。",
    "@ts-expect-error が意図した箇所で型エラーを確認しているか確認する。",
  ],
  doneWhen: [
    "不正な遷移が型または Result のどちらで止まるか説明できる。",
    "Scheduled または CheckedIn からだけキャンセルでき、キャンセル理由、時刻、任意の再診希望を Canceled 以外へ付けられないことを説明できる。",
  ],
  changeImpact: "状態とデータを同時に閉じるため、後続の use case は許可された状態だけを前提にできます。",
  reflectionQuestions: [
    "不正な状態は生成時に防ぐべきですか、それとも遷移関数の Result で拒否すべきですか。",
  ],
  fallbackGuidance: "提示済みの Appointment union を使い、2関数だけを kind で分岐させます。@ts-expect-error が意図した箇所にあるか確認します。",
  workedExamples: [
    { file: "src/clinic/appointment.ts", symbols: ["Appointment.startExamination", "Appointment.cancelWithReason"] },
  ],
  resources: [],
  blocks: [
    {
      kind: "prose",
      heading: "要求を状態へ置く",
      paragraphs: [
        "キャンセル理由、キャンセル時刻、再診希望日は、すべての予約に付く optional field ではありません。Canceled という状態だけが持つ業務情報です。",
        "キャンセルは Scheduled または CheckedIn から行えます。診察を開始した後や会計済みの予約はキャンセルへ遷移させません。",
        "状態を文字列で上書きする代わりに、kind で区別した union の次の値を返します。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
      expected: "starter の不足を確認します。この実装を読む環境では worked example があるため成功します。",
    },
    {
      kind: "file-table",
      heading: "読む場所と編集場所",
      rows: [
        {
          file: "packages/clinic-example/src/clinic/appointment.ts",
          focus: "Appointment union、book、checkIn、recordPayment、isTerminal は状態の全体像を読む。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/appointment.ts",
          focus: "CheckedIn のときだけ InExamination を返す。",
          mode: "edit",
        },
        {
          file: "packages/clinic-example/src/clinic/appointment.ts",
          focus: "Scheduled または CheckedIn から、理由、キャンセル時刻、任意の再診希望を持つ Canceled を返す。",
          mode: "edit",
        },
      ],
    },
    {
      kind: "code",
      heading: "状態とデータを同時に閉じる",
      language: "typescript",
      code: "type Appointment =\n  | Readonly<{ kind: \"Scheduled\"; id: AppointmentId }>\n  | Readonly<{ kind: \"CheckedIn\"; id: AppointmentId }>\n  | Readonly<{ kind: \"InExamination\"; id: AppointmentId }>\n  | Readonly<{ kind: \"Paid\"; id: AppointmentId }>\n  | Readonly<{ kind: \"Canceled\"; id: AppointmentId; reason: CancelReason; canceledAt: string; followUpRequestedAt?: string }> ;",
    },
    {
      kind: "checklist",
      heading: "レビューすること",
      items: [
        "Paid と Canceled を終端状態として扱う。",
        "Canceled 以外にキャンセル理由、キャンセル時刻、再診希望を広げない。",
        "@ts-expect-error が不正な組み合わせを型エラーとして検査する。",
      ],
    },
    {
      kind: "command",
      phase: "green",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
      expected: "診察開始と理由付きキャンセルを表現でき、exercise:01 が成功します。",
    },
  ],
};
