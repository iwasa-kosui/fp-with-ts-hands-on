export const answerNotes: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "01-state-transitions": {
    "eslint.config.mjs":
      "「kind の検証を削除し、型アサーション（as）で来院済みの型に変更して渡す」と「kind の検証を削除し、unknown を経由した as で渡す」（任意）を検出します。",
    "exercises/guard/mine/callers.test.ts":
      "「kind の検証を削除し、型アサーション（as）で来院済みの型に変更して渡す」と「kind の検証を削除し、unknown を経由した as で渡す」（任意）を検出します。",
    "exercises/guard/mine/transitions.test.ts":
      "「キャンセルの理由ではなく来院の理由を格納する」と「診察開始の時刻に来院の時刻を格納する」（任意）を検出します。",
    "exercises/guard/mine/transitions.type-test.ts":
      "「診察開始の引数を Appointment 全体に広げる」と「会計の引数を Appointment 全体に広げる」（任意）を検出します。",
  },
  "02-adt-and-exhaustiveness": {
    "eslint.config.mjs":
      "「Paid の case を消しても、default の assertNever が残っている」、「Paid の case を消し、default が「不明」を返す」、「7つ目の状態を追加し、表示名を実装していない」、「別の関数の switch で、状態の case が1つ足りない」（任意）を検出します。",
    "exercises/guard/mine/statusLabel.test.ts":
      "「Paid の case を消しても、default の assertNever が残っている」、「Paid の case を消し、default が「不明」を返す」、「switch をやめて if の連なりにし、Paid の判定が抜ける」（任意）を検出します。",
    "exercises/guard/mine/statusLabel.type-test.ts":
      "「引数の kind が string に戻り、知らない状態を渡せる」を検出します。",
  },
  "03-boundaries-and-pii": {
    "eslint.config.mjs":
      "「parse が any を受け取り、検査せずに値を取り出す」、「parse が unknown を型アサーションで通す」、「route が parse を通さず、body をそのまま渡す」（任意）を検出します。",
    "exercises/guard/mine/audit.test.ts":
      "「監査記録に飼い主の連絡先が入る」を検出します。",
    "exercises/guard/mine/audit.type-test.ts":
      "「監査記録に飼い主の連絡先が入る」を検出します。",
    "exercises/guard/mine/handler.test.ts":
      "「route が parse を通さず、body をそのまま渡す」（任意）を検出します。",
    "exercises/guard/mine/ids.type-test.ts":
      "「予約IDと獣医師IDの型が同じになり、取り違えられる」（任意）を検出します。",
    "exercises/guard/mine/input.test.ts":
      "「parse が any を受け取り、検査せずに値を取り出す」、「parse が unknown を型アサーションで通す」、「schema が UUID かどうかを検証しない」を検出します。",
  },
  "04-workflow-errors": {
    "eslint.config.mjs":
      "「予約が見つからないとき、useCase が Err を返さずに例外を投げる」、「_unsafeUnwrap で、失敗を例外に変える」（任意）、「追加した失敗の種類を、呼び出し側の分岐が default で受ける」（任意）を検出します。",
    "exercises/guard/mine/startExamination.test.ts":
      "「予約が見つからないとき、useCase が Err を返さずに例外を投げる」、「失敗を返す場合にも、保存を実行する」、「保存の障害を、業務の失敗の Err に変換する」、「_unsafeUnwrap で、失敗を例外に変える」（任意）を検出します。",
  },
  "05-business-events-and-workflows": {
    "eslint.config.mjs":
      "「domain の予約が、adaptor/primary/web の変換関数を import する」、「domain の予約が、adaptor/secondary/sqlite の行の型を import する」、「domain の予約が、useCase を import する」（任意）を検出します。",
    "exercises/guard/mine/cancelAppointment.test.ts":
      "「会計済みの予約のキャンセルを通す」を検出します。",
    "exercises/guard/mine/reason.test.ts":
      "「キャンセル理由が、空の文字列でも通る」（任意）を検出します。",
  },
  "06-effects-and-consistency": {
    "eslint.config.mjs":
      "「イベントの時刻を、clock ではなく new Date() から作る」、「イベントIDを、ID generator ではなく乱数から作る」、「イベントの時刻を、Date.now() から作る」を検出します。",
    "exercises/guard/mine/useCase.test.ts":
      "「イベントの時刻を、clock ではなく new Date() から作る」、「イベントIDを、ID generator ではなく乱数から作る」、「イベントの時刻を、Date.now() から作る」、「状態の保存と監査記録の保存で、store を2回呼ぶ」、「イベントの時刻を、診察開始の時刻とは別に clock から読み直す」（任意）、「store の結果を待たず、競合しても呼び出し側に Err が返らない」（任意）を検出します。",
  },
};

export const answerNoteFor = (
  slug: string | undefined,
  path: string,
): string | undefined =>
  slug === undefined ? undefined : answerNotes[slug]?.[path];
