import { describe, expect, it } from "vitest";
import {
  assertModuleMeetsPrd,
  type ModuleContent,
} from "./module-content";

const validModule: ModuleContent = {
  id: "01-state-modeling",
  slug: "01-state-modeling",
  label: "Module 01",
  title: "状態遷移を型にする",
  durationMinutes: 35,
  caseStudy: {
    animalName: "Mugi",
    animalType: "犬",
    avatar: "🐕",
    context: "動物病院の予約と診察",
  },
  trigger: {
    kind: "new-requirement",
    situation: "予約状態へキャンセル情報を追加します。",
    requirement: "キャンセル理由と再診希望を誤った状態に付けられないようにします。",
  },
  invariant: "Paid と Canceled は終端状態です。",
  mission: "状態と必須データを判別共用体へ閉じます。",
  technique: {
    name: "Discriminated Union",
    reason: "状態と必須データを同じ variant に閉じます。",
    limits: "外部の unknown 入力と PII の実行時漏えいは別の境界で守ります。",
  },
  editTargets: [
    { file: "src/clinic/appointment.ts", symbol: "Appointment.startExamination" },
    { file: "src/clinic/appointment.ts", symbol: "Appointment.cancelWithReason" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "不正な状態遷移または不足した状態データを検出します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:01",
    expected: "状態遷移と型テストが成功します。",
  },
  filesToRead: [
    { file: "src/clinic/appointment.ts", focus: "Appointment union と終端状態" },
  ],
  reviewPoints: ["kind の網羅性を確認します。"],
  doneWhen: ["不正な状態をどこで拒否するか説明できます。"],
  changeImpact: "次の状態追加で確認する分岐が kind に集約されます。",
  reflectionQuestions: ["不正な状態は生成時と遷移時のどちらで拒否しますか。"],
  fallbackGuidance: "提示済み union を使い、2関数だけを kind で分岐させます。",
  workedExamples: [
    {
      file: "src/clinic/appointment.ts",
      symbols: ["Appointment.startExamination", "Appointment.cancelWithReason"],
    },
  ],
  resources: [],
  blocks: [
    { kind: "prose", heading: "要求を読む", paragraphs: ["終端状態を先に確認します。"] },
  ],
};

describe("assertModuleMeetsPrd", () => {
  it("PRD 必須項目が揃ったモジュールを受理する", () => {
    expect(() => assertModuleMeetsPrd(validModule)).not.toThrow();
  });

  it("レビュー要求を起点とするモジュールを受理する", () => {
    const reviewModule = {
      ...validModule,
      trigger: {
        kind: "review" as const,
        situation: "レビューで状態追加時の分岐漏れが指摘されました。",
        reviewProblem: "新しい kind を追加しても網羅性確認が不足しています。",
      },
    };

    expect(() => assertModuleMeetsPrd(reviewModule)).not.toThrow();
  });

  it("編集対象が3関数なら拒否する", () => {
    const invalid = {
      ...validModule,
      editTargets: [
        ...validModule.editTargets,
        { file: "src/clinic/appointment.ts", symbol: "Appointment.checkIn" },
      ],
    };
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-06");
  });

  it("技法の限界が空なら拒否する", () => {
    const invalid = {
      ...validModule,
      technique: { ...validModule.technique, limits: "" },
    };
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-05");
  });

  it.each([
    [
      "起点の状況",
      {
        ...validModule,
        trigger: {
          kind: "new-requirement" as const,
          situation: "   ",
          requirement: "キャンセル理由と再診希望を誤った状態に付けられないようにします。",
        },
      },
    ],
    [
      "起点の詳細",
      {
        ...validModule,
        trigger: {
          kind: "new-requirement" as const,
          situation: "予約状態へキャンセル情報を追加します。",
          requirement: "   ",
        },
      },
    ],
    ["不変条件", { ...validModule, invariant: "   " }],
    ["ミッション", { ...validModule, mission: "   " }],
  ])("PRD-02: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-02");
  });

  it.each([
    ["Red command", { ...validModule, red: { ...validModule.red, command: "   " } }],
    ["Red expected", { ...validModule, red: { ...validModule.red, expected: "   " } }],
    ["読むファイル", { ...validModule, filesToRead: [] }],
    [
      "読むファイルのパス",
      { ...validModule, filesToRead: [{ ...validModule.filesToRead[0]!, file: "   " }] },
    ],
    [
      "読むファイルの注目箇所",
      { ...validModule, filesToRead: [{ ...validModule.filesToRead[0]!, focus: "   " }] },
    ],
  ])("PRD-03: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-03");
  });

  it.each([
    ["技法名", { ...validModule, technique: { ...validModule.technique, name: "   " } }],
    ["適用理由", { ...validModule, technique: { ...validModule.technique, reason: "   " } }],
  ])("PRD-04: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-04");
  });

  it.each([
    ["Green command", { ...validModule, green: { ...validModule.green, command: "   " } }],
    ["Green expected", { ...validModule, green: { ...validModule.green, expected: "   " } }],
    ["変更効果", { ...validModule, changeImpact: "   " }],
    ["レビュー観点", { ...validModule, reviewPoints: [] }],
    ["レビュー観点の説明", { ...validModule, reviewPoints: ["   "] }],
    ["完了条件", { ...validModule, doneWhen: [] }],
    ["完了条件の説明", { ...validModule, doneWhen: ["   "] }],
  ])("PRD-07: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-07");
  });

  it.each([
    ["設問がない", { ...validModule, reflectionQuestions: [] }],
    ["空の設問", { ...validModule, reflectionQuestions: ["   "] }],
  ])("PRD-08: %sなら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-08");
  });

  it.each([
    ["代替進行", { ...validModule, fallbackGuidance: "   " }],
    ["worked example", { ...validModule, workedExamples: [] }],
    [
      "worked exampleのファイル",
      {
        ...validModule,
        workedExamples: [{ ...validModule.workedExamples[0]!, file: "   " }],
      },
    ],
    [
      "worked exampleのsymbol一覧",
      {
        ...validModule,
        workedExamples: [{ ...validModule.workedExamples[0]!, symbols: [] }],
      },
    ],
    [
      "worked exampleのsymbol",
      {
        ...validModule,
        workedExamples: [{ ...validModule.workedExamples[0]!, symbols: ["   "] }],
      },
    ],
  ])("PRD-12: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-12");
  });

  it.each([
    [
      "編集対象のファイル",
      { ...validModule, editTargets: [{ ...validModule.editTargets[0]!, file: "   " }] },
    ],
    [
      "編集対象のsymbol",
      { ...validModule, editTargets: [{ ...validModule.editTargets[0]!, symbol: "   " }] },
    ],
  ])("PRD-06: %sが空なら拒否する", (_label, invalid) => {
    expect(() => assertModuleMeetsPrd(invalid)).toThrow("PRD-06");
  });
});
