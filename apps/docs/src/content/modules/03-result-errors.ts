import type { ModuleContent } from "../module-content";

export const resultErrorsModule: ModuleContent = {
  id: "03-result-errors",
  slug: "03-result-errors",
  label: "HAMSTER",
  title: "失敗理由と変更記録を返す",
  durationMinutes: 30,
  caseStudy: {
    animalName: "HAMSTER",
    animalType: "hamster",
    avatar: "🐹",
    context: "ハムスターの診察開始で、画面に失敗理由を返し成功だけを記録します。",
  },
  trigger: {
    kind: "new-requirement",
    situation: "診察開始の結果を UI と事故調査の両方で扱えるようにします。",
    requirement: "診察開始の失敗理由を UI に表示し、成功した開始だけを追跡したい。",
  },
  invariant: "失敗は Result の kind で返し、ExaminationStarted は成功時だけ記録する。",
  mission: "呼び出し元が失敗を網羅的に分岐できる値と、成功した変更だけを示す event を分けます。",
  technique: {
    name: "Result と最小の Domain Event",
    reason: "呼び出し元が失敗理由を網羅的に分岐し、成功した変更だけを追跡できるようにします。",
    limits: "event sourcing、projection、永続イベントストアには広げません。",
  },
  editTargets: [
    { file: "src/clinic/use-cases.ts", symbol: "startExaminationUseCase" },
  ],
  red: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
    expected: "starter では診察開始の成功と ExaminationStarted の append に関するテストが失敗します。",
  },
  green: {
    command: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
    expected: "成功した診察開始を返し、ExaminationStarted を append できてテストが成功します。",
  },
  filesToRead: [
    {
      file: "src/clinic/use-cases.ts",
      focus: "StartExaminationError、入力 schema、ensureFound、ensureCheckedIn と startExaminationUseCase の成功・失敗経路を読みます。",
    },
    {
      file: "src/clinic/appointment-repository.ts",
      focus: "findById と save が use case のどの結果で呼ばれるか確認します。",
    },
    {
      file: "src/clinic/domain-event-store.ts",
      focus: "append と all を読み、成功した変更記録だけを保存する責務を確認します。",
    },
    {
      file: "exercises/03-result-errors.test.ts",
      focus: "成功した診察開始と ExaminationStarted の append に関する期待値を確認します。失敗の分岐は use-cases.ts の error union と guard から読みます。",
    },
  ],
  reviewPoints: [
    "StartExaminationError の kind を UI が網羅的に分岐できるか確認する。",
    "schema、存在確認、状態確認の失敗で repository 保存と event 記録が行われないか確認する。",
    "ExaminationStarted が診察開始の成功後にだけ append されるか確認する。",
  ],
  doneWhen: [
    "UI が分岐できる失敗値と、成功した変更記録を区別できる。",
    "失敗ケースでは event store が空で、成功ケースだけ ExaminationStarted があると説明できる。",
  ],
  changeImpact: "UI は失敗理由を値として表示でき、監査では成功した診察開始だけを後から追えます。",
  reflectionQuestions: [
    "UI に返す失敗値と、事故調査のために残す成功イベントは、なぜ別の値ですか。",
  ],
  fallbackGuidance: "StartExaminationError の union と各 guard の Err return を読み、exercise:03 では成功時の ExaminationStarted append だけを確認します。",
  workedExamples: [
    { file: "src/clinic/use-cases.ts", symbols: ["startExaminationUseCase"] },
  ],
  resources: [
    { label: "ドメインイベントを容易に記録する設計", href: "https://kosui.me/posts/2025/05/06/142842" },
  ],
  blocks: [
    {
      kind: "prose",
      heading: "失敗を値として読む",
      paragraphs: [
        "失敗を throw や undefined に混ぜると、UI はどの表示を選ぶべきか判断できません。StartExaminationError の kind を Result の Err として返し、呼び出し元が失敗理由を分岐できるようにします。",
        "入力 schema、予約の存在、現在の状態のどこで止まっても、診察開始は成功していません。失敗経路では予約の保存も event の記録も行いません。",
      ],
    },
    {
      kind: "command",
      phase: "red",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
      expected: "starter では成功した診察開始と ExaminationStarted の append が不足します。この実装を読む環境では worked example があるため成功します。",
    },
    {
      kind: "file-table",
      heading: "読む場所と編集場所",
      rows: [
        {
          file: "packages/clinic-example/src/clinic/use-cases.ts",
          focus: "StartExaminationError、schema、guard と既存の成功経路を読む。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/appointment-repository.ts",
          focus: "findById と save の責務を読む。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/domain-event-store.ts",
          focus: "成功した変更だけを append する store の責務を読む。",
          mode: "read",
        },
        {
          file: "packages/clinic-example/src/clinic/use-cases.ts",
          focus: "startExaminationUseCase だけを編集し、Err の早期 return と成功後の event 記録を置く。",
          mode: "edit",
        },
      ],
    },
    {
      kind: "code",
      heading: "失敗と成功を別の値にする",
      language: "typescript",
      code: "type StartExaminationError =\n  | Readonly<{ kind: \"AppointmentNotFound\" }>\n  | Readonly<{ kind: \"InvalidAppointmentState\" }>\n  | Readonly<{ kind: \"ValidationError\" }>;\n\nif (checkedIn.kind === \"Err\") return checkedIn;\n\ninput.eventStore.append(ExaminationStarted.create({ /* successful change */ }));",
    },
    {
      kind: "checklist",
      heading: "レビューすること",
      items: [
        "失敗理由が Result の error.kind として呼び出し元へ返る。",
        "失敗時に repository.save と eventStore.append が呼ばれない。",
        "成功時だけ ExaminationStarted を記録する。",
        "event sourcing、projection、永続イベントストアへ広げない。",
      ],
    },
    {
      kind: "command",
      phase: "green",
      command: "pnpm --filter @fp-with-ts/clinic-example exercise:03",
      expected: "成功した診察開始を返し、ExaminationStarted を append できて exercise:03 が成功します。",
    },
  ],
};
