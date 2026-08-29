# Task 5 実施報告

Session 05 の診察開始を、snapshot 内で所有する file SQLite adapter へ接続しました。Session 04 や Session 01 の source は runtime で参照していません。

## RED と GREEN

最初に `test/integration/fileSqliteContinuity.test.ts` を追加しました。SQLite依存を package に宣言した後、`pnpm --filter @fp-with-ts/clinic-session-05 test -- fileSqliteContinuity.test.ts` は `createDatabaseBackedApp is not a function` で失敗しました。これは file database の合成ルートが未実装だったためです。

SQLite adapter、migration、composition root を追加後、同じテストは3件すべて成功しました。診察開始の状態と監査は file database を閉じた後に観測しており、in-memory store へ戻すと検証できません。

## PII と永続化失敗

`ExaminationStarted` の payload は `appointmentId`、`veterinarianId`、`examinationStartedAt` だけを持ちます。aggregate 全体や owner contact を渡していないため、氏名、メールアドレス、電話番号を文字列化した payload から検出できないことを確認しました。

監査 INSERT を失敗させる SQLite trigger では、予約 state が `InExamination` のまま残り、監査件数は seed の1件のままでした。これは state 保存と監査追記が transaction に入っていないことを確認しています。trigger の原因には連絡先を含めましたが、呼び出し元に渡る `AppointmentPersistenceError` は `Appointment persistence failed: append-audit` だけを返し、連絡先を含みません。

DB query と書き込みの SQLite 例外だけを `resolve`、`save-state`、`append-audit` の `AppointmentPersistenceError` に変換しています。永続化 state の Zod 検証失敗はこの例外へ変換しません。

## 入力境界と lifecycle

不正な予約 ID と獣医師 ID は、`StartExaminationInput` の検証で resolver より前に拒否され、HTTP 500 の前後で予約 state と監査件数が変わらないことを file SQLite で確認しました。

server entry は HTTP server を起動せず、signal handler も持ちません。SQLite resource は app owner が閉じ、production exit と development の HMR、Vite server close で環境側が終了を管理します。close は重複しても native connection を1回だけ閉じます。

## 演習と検証

`useCase/errors.ts`、`useCase/startExamination.ts`、`web/routes.ts` は base `a5340e12be11427a8598dd9984e984576fe34d34` から変更していません。削除した in-memory 実装の type-only declaration は route の演習用 import を維持し、runtime の in-memory store は残していません。

2026-08-30 に以下を実行しました。

- `pnpm --filter @fp-with-ts/clinic-session-05 test` は6 files、22 tests が成功しました。
- `pnpm --filter @fp-with-ts/clinic-session-05 typecheck` は成功しました。
- `pnpm --filter @fp-with-ts/clinic-session-05 build` は client と SSR build が成功しました。
- `pnpm exercise:05` は Result 課題の既存5件だけが失敗し、module resolution と追加の TypeScript error はありません。
- `git diff --check` は成功しました。

## 留意点

監査保存が失敗すると state だけが残る挙動は、Session 06 と Session 07 の比較対象として意図的に維持しています。Session 05 では transaction を追加していません。
