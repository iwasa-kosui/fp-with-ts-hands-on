import { projectFilesForSnapshot } from "../code-explorer/project-files";
import { blockOf, sourceOf } from "./source-quotes";

export type FrameStatus = "neutral" | "pass" | "stop" | "danger";

export type WalkthroughFrame = Readonly<{
  fileId: string;
  from: number;
  to: number;
  zone: 0 | 1 | 2;
  status: FrameStatus;
  valueLabel: string;
  value: string;
  text: string;
}>;

export type Walkthrough = Readonly<{
  title: string;
  description: string;
  descriptionWithoutCode?: string;
  zones: readonly [string, string, string];
  files: readonly Readonly<{ id: string; path: string; code: string }>[];
  scenarios: readonly Readonly<{
    id: string;
    label: string;
    note: string;
    frames: readonly WalkthroughFrame[];
  }>[];
}>;

type FrameInput = Omit<WalkthroughFrame, "fileId" | "from" | "to"> &
  Readonly<{ first: string; last?: string }>;

const frameBuilder =
  (files: Walkthrough["files"]) =>
  (fileId: string, { first, last = first, ...rest }: FrameInput): WalkthroughFrame => {
    const file = files.find(({ id }) => id === fileId);
    if (file === undefined) throw new Error(`${fileId} is not a walkthrough file`);
    const lines = file.code.split("\n");
    const from = lines.findIndex((line) => line.includes(first));
    const to = lines.findIndex((line, index) => index >= from && line.includes(last));
    if (from < 0 || to < 0) {
      throw new Error(`${file.path} has no lines from "${first}" to "${last}"`);
    }
    return { fileId, from, to, ...rest };
  };

const session04 = projectFilesForSnapshot("session-04");
const session05 = projectFilesForSnapshot("session-05");

const appointmentUuid = "11111111-1111-4111-8111-111111111111";
const veterinarianUuid = "44444444-4444-4444-8444-444444444444";

const startExaminationFiles: Walkthrough["files"] = [
  {
    id: "route",
    path: "examples/session-04/src/web/routes.ts",
    code: blockOf(
      session04,
      "src/web/routes.ts",
      '  app.post("/appointments/:appointmentId/start-examination", async (context) => {',
      "  });",
    ),
  },
  {
    id: "parseBefore",
    path: "examples/session-04/src/boundary/startExaminationInput.ts（修正前）",
    code: sourceOf(session04, "src/boundary/startExaminationInput.ts"),
  },
  {
    id: "parseAfter",
    path: "examples/session-05/src/boundary/startExaminationInput.ts（修正後）",
    code: sourceOf(session05, "src/boundary/startExaminationInput.ts"),
  },
  {
    id: "schemaResult",
    path: "examples/session-05/src/shared/schemaResult.ts",
    code: sourceOf(session05, "src/shared/schemaResult.ts"),
  },
  {
    id: "appointmentId",
    path: "examples/session-05/src/domain/appointment/appointmentId.ts",
    code: sourceOf(session05, "src/domain/appointment/appointmentId.ts"),
  },
  {
    id: "veterinarianId",
    path: "examples/session-05/src/domain/appointment/veterinarianId.ts",
    code: sourceOf(session05, "src/domain/appointment/veterinarianId.ts"),
  },
  {
    id: "transition",
    path: "examples/session-04/src/domain/appointment/transitions.ts",
    code: blockOf(
      session04,
      "src/domain/appointment/transitions.ts",
      "export const startExamination = (",
      "  }) as const satisfies InExamination;",
    ),
  },
];

const startFrame = frameBuilder(startExaminationFiles);

const rawOf = (veterinarianLine: string) =>
  `{\n  appointmentId: "${appointmentUuid}",\n  veterinarianId: ${veterinarianLine},\n}`;

const arrivalFrames = (veterinarianLine: string) => [
  startFrame("route", {
    first: "const raw = await context.req.json",
    zone: 0,
    status: "neutral",
    valueLabel: "request body",
    value: `{ veterinarianId: ${veterinarianLine} }`,
    text: "HTTPのリクエストが届きます。bodyの中身は、まだ何も確かめていません。",
  }),
  startFrame("route", {
    first: "const input = StartExaminationInput.parse({",
    last: "veterinarianId: raw.veterinarianId,",
    zone: 0,
    status: "neutral",
    valueLabel: "parse へ渡す値",
    value: rawOf(veterinarianLine),
    text: "routeは、URLの予約IDとbodyのveterinarianIdを1つのobjectにまとめ、parseへ渡します。",
  }),
];

const checkedFrames = (
  veterinarianLine: string,
  veterinarianPasses: boolean,
) => {
  const raw = rawOf(veterinarianLine);
  return [
    startFrame("parseAfter", {
      first: "const schema = z.object({",
      last: "}).readonly();",
      zone: 1,
      status: "neutral",
      valueLabel: "parse へ渡された値",
      value: raw,
      text: "入力全体の検査は、2つのIDのschemaを組み合わせたobject schemaで表します。",
    }),
    startFrame("parseAfter", {
      first: "parse: schemaResult(schema),",
      zone: 1,
      status: "neutral",
      valueLabel: "parse へ渡された値",
      value: raw,
      text: "parseの実体は、schemaResultがこのschemaから作った関数です。",
    }),
    startFrame("schemaResult", {
      first: "(raw: unknown): Result<T> => {",
      last: "const parsed = schema.safeParse(raw);",
      zone: 1,
      status: "neutral",
      valueLabel: "safeParse へ渡す値",
      value: raw,
      text: "parseはunknownを受け取り、schemaのsafeParseで検査します。入力の形を仮定しません。",
    }),
    startFrame("appointmentId", {
      first: 'const schema = z.string().uuid().brand<"AppointmentId">();',
      zone: 1,
      status: "pass",
      valueLabel: "appointmentId の検査: UUID の形なので合格",
      value: `"${appointmentUuid}"`,
      text: "1つ目の項目です。予約IDはUUIDの形なので合格します。",
    }),
    startFrame("veterinarianId", {
      first: 'const schema = z.string().uuid().brand<"VeterinarianId">();',
      zone: 1,
      status: veterinarianPasses ? "pass" : "stop",
      valueLabel: `veterinarianId の検査: ${veterinarianPasses ? "UUID の形なので合格" : "UUID の形ではないので不合格"}`,
      value: veterinarianLine,
      text: veterinarianPasses
        ? "2つ目の項目です。担当獣医師IDの欄の値もUUIDの形なので合格します。"
        : "2つ目の項目です。UUIDの形ではないので不合格です。",
    }),
  ];
};

const passedFrames = (veterinarianUuidValue: string, lastText: string) => {
  const typed = `Ok({\n  appointmentId: "${appointmentUuid}", // AppointmentId\n  veterinarianId: "${veterinarianUuidValue}", // VeterinarianId\n})`;
  return [
    startFrame("schemaResult", {
      first: "return parsed.success ? ok(parsed.data) : err();",
      zone: 1,
      status: "pass",
      valueLabel: "parse の結果",
      value: typed,
      text: "全項目が合格したので、ok(parsed.data)を呼びます。型の上では、この値がStartExaminationInputになります。",
    }),
    startFrame("schemaResult", {
      first: "export const ok = <T>(value: T): Result<T> => ({",
      last: "});",
      zone: 1,
      status: "pass",
      valueLabel: "parse の結果",
      value: typed,
      text: "okは値を持つResultを返します。_unsafeUnwrapを呼ぶと、その値が返ります。",
    }),
    startFrame("route", {
      first: "})._unsafeUnwrap();",
      zone: 2,
      status: "pass",
      valueLabel: "input（StartExaminationInput）",
      value: `{\n  appointmentId: "${appointmentUuid}",\n  veterinarianId: "${veterinarianUuidValue}",\n}`,
      text: "routeはOkの中身を取り出します。ここから先が内側です。",
    }),
    startFrame("route", {
      first: "startExamination(",
      last: '"2026-08-30T06:30:00.000Z",',
      zone: 2,
      status: "pass",
      valueLabel: "startExamination へ渡す値",
      value: `{\n  veterinarianId: "${veterinarianUuidValue}",\n  examinationStartedAt: "2026-08-30T06:30:00.000Z",\n}`,
      text: "routeは、取り出したinputの獣医師IDと、routeに書かれた固定の時刻を、startExaminationへ渡します。この時刻はS06で扱う固定値です。",
    }),
    startFrame("transition", {
      first: "veterinarianId: VeterinarianId,",
      zone: 2,
      status: "pass",
      valueLabel: "startExamination の引数",
      value: `veterinarianId: "${veterinarianUuidValue}" // VeterinarianId`,
      text: lastText,
    }),
  ];
};

const rejectedFrames = [
  startFrame("schemaResult", {
    first: "return parsed.success ? ok(parsed.data) : err();",
    zone: 1,
    status: "stop",
    valueLabel: "parse の結果",
    value: "Err()",
    text: "不合格の項目があるので、err()を呼びます。この場合、parseはStartExaminationInputを返しません。",
  }),
  startFrame("schemaResult", {
    first: "export const err = <T>(): Result<T> => ({",
    last: "isOk: () => false,",
    zone: 1,
    status: "stop",
    valueLabel: "parse の結果",
    value: "Err()",
    text: "errは値を持たないResultを返します。isErrはtrueを返します。",
  }),
  startFrame("route", {
    first: "})._unsafeUnwrap();",
    zone: 1,
    status: "stop",
    valueLabel: "route が受け取った結果",
    value: "Err()",
    text: "routeがErrに_unsafeUnwrapを呼びます。Resultを使った分岐はS04で扱います。",
  }),
  startFrame("schemaResult", {
    first: 'throw new Error("Cannot unwrap an invalid boundary value");',
    zone: 1,
    status: "stop",
    valueLabel: "内側に届いた値",
    value: "// なし",
    text: "Errの_unsafeUnwrapは例外を投げます。routeの次の行へ進まないので、startExaminationは呼ばれません。検査の失敗は今は500のエラーになります。この扱いはS04で学びます。",
  }),
];

export const startExaminationWalkthrough: Walkthrough = {
  title: "値が境界を通る様子",
  description:
    "場面を選んで再生します。上の帯は値が今いる場所、下のコードは今説明している行です。",
  descriptionWithoutCode:
    "場面を選んで再生します。上の帯は、値が今いる場所です。",
  zones: ["外側", "境界", "内側"],
  files: startExaminationFiles,
  scenarios: [
    {
      id: "valid",
      label: "獣医師が診察開始を送信した",
      note: "veterinarianId は獣医師の UUID",
      frames: [
        ...arrivalFrames(`"${veterinarianUuid}"`),
        ...checkedFrames(`"${veterinarianUuid}"`, true),
        ...passedFrames(
          veterinarianUuid,
          "startExaminationは、型がVeterinarianIdの値を受け取ります。HTTPで届く入力は境界で検査済みなので、関数の中で同じ検査を繰り返しません。",
        ),
      ],
    },
    {
      id: "night-shift",
      label: "画面の不具合で、獣医師の代わりに「夜勤」と届いた",
      note: 'veterinarianId は "night-shift"',
      frames: [
        ...arrivalFrames(`"night-shift"`),
        ...checkedFrames(`"night-shift"`, false),
        ...rejectedFrames,
      ],
    },
    {
      id: "wrong-uuid",
      label: "画面の不具合で、獣医師の欄に予約のIDが届いた",
      note: "veterinarianId は予約の UUID",
      frames: [
        ...arrivalFrames(`"${appointmentUuid}"`),
        ...checkedFrames(`"${appointmentUuid}"`, true),
        ...passedFrames(
          appointmentUuid,
          "形は正しいので内側まで届きます。境界で確かめられるのは形までで、そのUUIDが実在の獣医師を指すかどうかは分かりません。",
        ),
      ],
    },
    {
      id: "before",
      label: "同じ「夜勤」が、検査しない今のコードに届いた",
      note: "検査しない修正前の parse",
      frames: [
        ...arrivalFrames(`"night-shift"`),
        startFrame("parseBefore", {
          first: "parse: (raw: any): Result<StartExaminationInput> =>",
          zone: 1,
          status: "danger",
          valueLabel: "parse へ渡された値（型は any）",
          value: rawOf(`"night-shift"`),
          text: "修正前のparseはrawをanyで受け取ります。anyには、どんな値でも何の確認もなく入ります。",
        }),
        startFrame("parseBefore", {
          first: "ok({",
          last: "}),",
          zone: 1,
          status: "danger",
          valueLabel: "parse の結果",
          value: `Ok({\n  appointmentId: "${appointmentUuid}",\n  veterinarianId: "night-shift",\n})`,
          text: "値を確かめずに2項目をコピーし、必ずokを呼びます。",
        }),
        startFrame("schemaResult", {
          first: "export const ok = <T>(value: T): Result<T> => ({",
          last: "});",
          zone: 1,
          status: "danger",
          valueLabel: "parse の結果",
          value: `Ok({\n  appointmentId: "${appointmentUuid}",\n  veterinarianId: "night-shift",\n})`,
          text: "okは渡された値をそのまま持つResultを返します。okは値の中身を確かめません。",
        }),
        startFrame("route", {
          first: "})._unsafeUnwrap();",
          zone: 2,
          status: "danger",
          valueLabel: "input（StartExaminationInput）",
          value: `{\n  appointmentId: "${appointmentUuid}",\n  veterinarianId: "night-shift",\n}`,
          text: "Okなので、routeは値を取り出して先へ進みます。不正な値が内側へ入りました。",
        }),
        startFrame("transition", {
          first: "veterinarianId: VeterinarianId,",
          zone: 2,
          status: "danger",
          valueLabel: "startExamination の引数",
          value: `veterinarianId: "night-shift" // 型は VeterinarianId`,
          text: "型はVeterinarianIdなのに、中身はUUIDではありません。これが今回の事故です。",
        }),
      ],
    },
  ],
};

const sensitiveFiles: Walkthrough["files"] = [
  {
    id: "ownerContact",
    path: "examples/session-05/src/boundary/ownerContact.ts",
    code: sourceOf(session05, "src/boundary/ownerContact.ts"),
  },
  {
    id: "sensitive",
    path: "examples/session-05/src/shared/sensitive.ts",
    code: sourceOf(session05, "src/shared/sensitive.ts"),
  },
];

const sensitiveFrame = frameBuilder(sensitiveFiles);

const wrappedFrames = [
  sensitiveFrame("ownerContact", {
    first: "ownerEmail: z.string().email()",
    zone: 1,
    status: "neutral",
    valueLabel: "parse に渡すメールアドレス（説明用の値）",
    value: `ownerEmail: "owner@example.com"`,
    text: "入口の境界で形を検査したあと、transformでSensitive.ofに包みます。brandは他の値との取り違えを防ぐためのもので、ログには影響しません。",
  }),
  sensitiveFrame("sensitive", {
    first: "of: <T>(value: T): Sensitive<T> => ({",
    last: "unwrap: () => value,",
    zone: 0,
    status: "neutral",
    valueLabel: "contact.ownerEmail",
    value: "Sensitive // 中に owner@example.com を持つ",
    text: "内側の値は平文のstringではなくなります。平文を取り出す方法はunwrapだけです。",
  }),
];

const hiddenFrame = (
  first: string,
  call: string,
  output: string,
  text: string,
): WalkthroughFrame =>
  sensitiveFrame("sensitive", {
    first,
    zone: 2,
    status: "pass",
    valueLabel: call,
    value: output,
    text,
  });

export const sensitiveWalkthrough: Walkthrough = {
  title: "内側の値が外へ出る様子",
  description: "場面を選んで再生します。ログやJSONに書き出しても値は伏せられ、unwrap を呼んだ箇所だけ平文が出ます。",
  zones: ["内側", "境界", "外側（ログなど）"],
  files: sensitiveFiles,
  scenarios: [
    {
      id: "log",
      label: "メールアドレスをログに書き出す",
      note: "console.log(contact.ownerEmail)",
      frames: [
        ...wrappedFrames,
        hiddenFrame(
          '[inspect.custom]: () => "[REDACTED]"',
          "console.log(contact.ownerEmail)",
          "[REDACTED]",
          "inspect.customは、Node.jsがconsole.logで値を文字にするときに呼ぶ関数を決める名前です。console.logはその結果を出力するので、ログには[REDACTED]が出ます。",
        ),
      ],
    },
    {
      id: "json",
      label: "連絡先全体を JSON にして書き出す",
      note: "JSON.stringify(contact)",
      frames: [
        ...wrappedFrames,
        hiddenFrame(
          'toJSON: () => "[REDACTED]"',
          "JSON.stringify(contact)",
          `{"ownerName":"[REDACTED]","ownerEmail":"[REDACTED]","ownerPhone":"[REDACTED]"}`,
          "toJSONは、JSON.stringifyが値を文字列にするときに呼ぶメソッドの名前です。JSON.stringifyはその結果を使うので、3項目とも[REDACTED]になります。",
        ),
      ],
    },
    {
      id: "unwrap",
      label: "中身が必要な処理で平文を取り出す",
      note: "contact.ownerEmail.unwrap()",
      frames: [
        ...wrappedFrames,
        sensitiveFrame("sensitive", {
          first: "unwrap: () => value,",
          zone: 2,
          status: "danger",
          valueLabel: "contact.ownerEmail.unwrap()",
          value: "owner@example.com",
          text: "unwrapと明示した箇所だけ平文が出ます。unwrapで検索すれば、平文を取り出している箇所を調べられます。",
        }),
      ],
    },
  ],
};
