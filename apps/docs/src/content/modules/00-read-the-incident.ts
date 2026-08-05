import type { ModuleContent } from "../module-content";

export const readTheIncidentModule: ModuleContent = {
  id: "00-read-the-incident",
  slug: "00-read-the-incident",
  label: "CAT",
  title: "事故報告を読む",
  durationMinutes: 15,
  caseStudy: {
    animalName: "CAT",
    animalType: "cat",
    avatar: "🐈",
    context: "キャンセル後の業務対応に必要な情報を整理します。",
  },
  trigger: {
    kind: "new-requirement",
    situation: "キャンセル後の業務対応に必要な情報を整理します。",
    requirement: "キャンセル理由と再診希望日を残せるようにします。",
  },
  invariant: "Canceled は reason を持ち、再診希望はキャンセル時だけに存在します。",
  mission: "追加要求を、状態ごとに必要な情報へ分解します。",
  technique: {
    name: "状態別の要求整理",
    reason: "全予約への optional field 追加を避け、情報が属する状態を先に決めます。",
    limits: "このモジュールでは遷移関数を変更せず、次の状態モデリングに必要な整理までを行います。",
  },
  editTargets: [],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "キャンセル状態の必須情報と終端状態の制約がテストから読み取れます。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example test",
    expected: "要求整理では実装を変更しないため、通常テストは成功したままです。",
  },
  filesToRead: [
    {
      file: "src/legacy/appointment.ts",
      focus: "status だけでは、キャンセルされた理由も次の対応も分からない点を読みます。",
    },
    {
      file: "exercises/01-state-modeling.test.ts",
      focus: "キャンセル状態の必須情報と終端状態の制約を期待値から読みます。",
    },
  ],
  reviewPoints: ["状態ごとの必須プロパティを表にし、optional で逃がしていないか確認する。"],
  doneWhen: ["次の要求を状態の種類ごとの情報として言い換えられる。"],
  changeImpact: "キャンセル理由と再診希望を Canceled 状態に閉じる次のモデリングへ進めます。",
  reflectionQuestions: [
    "キャンセル理由と再診希望日を optional field にすると、どの不正な予約を表現できてしまいますか。",
  ],
  fallbackGuidance: "Scheduled と Canceled の必須情報を書き出し、Canceled 以外から reason と再診希望を外します。",
  workedExamples: [
    { file: "src/clinic/appointment.ts", symbols: ["Appointment", "Appointment.cancelWithReason"] },
  ],
  resources: [],
  blocks: [
    {
      kind: "prose",
      heading: "要求を分解する",
      paragraphs: [
        "キャンセル理由と再診希望日は、どの予約にも付ける属性ではありません。Canceled という状態にだけ必要なデータです。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
      expected: "キャンセル状態の必須情報と終端状態の制約を確認します。",
    },
    {
      kind: "prose",
      heading: "次の編集の準備",
      paragraphs: [
        "この実装には worked example が含まれるため exercise:01 は緑になります。当日の starter 差分では、同じ command を赤テストとして使い、状態とデータを同時に閉じる準備をします。",
      ],
    },
  ],
};
