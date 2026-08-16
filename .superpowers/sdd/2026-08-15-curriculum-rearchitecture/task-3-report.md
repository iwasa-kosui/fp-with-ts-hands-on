# Task 3 report — P1-B S3〜S5

## 実装結果

- `examples/session-03` に、実在する `src/useCase/{errors,dependencies,startExamination}.ts` と static import の4-step S3 exercise を追加した。starter は教材上の弱点として同期 resolver、実行時判定、`throw` / `try-catch` を残す。
- `examples/session-04` に、`ok` / `err` / `andThen` を使う同期 `Result` 解答と S1〜S3 regression を追加した。同じ snapshot の S4 starter は `Date` / `randomUUID` の直接呼び出し、状態保存と event log の dual-write、保存後に `void` を返す弱点を意図的に残す。
- `examples/session-05` に、`Clock`、`EventIdGenerator`、`EventContext`、`ExaminationStartedStore` を追加した。`Appointment.startExamination(context)(checkedIn, veterinarianId)` は純粋に `ExaminationStarted` を作り、use case は `ResultAsync` の `andThen` / `andThrough` / `map` で単一 pipeline を構成する。
- session-05 の in-memory adapter は `store(event)` の1回で aggregate state と event を commit し、adapter 境界の `ResultAsync.fromPromise` だけで Promise rejection を `RepositoryError` へ閉じる。
- Task 2 の暫定 dynamic imports と3件の `@ts-expect-error` を削除し、S1〜S4 の回帰を `session-05/test/regression/` に統合した。session-05 から exercise script、`exercises/`、exercise config を削除した。
- root scripts は session snapshot のみを test/typecheck 対象とし、exercise 01〜04 のみを公開する。root `build` は docs build のみにした。

## TDD evidence

### S3 RED

Command: `pnpm exercise:03`

Observed: static import の実在モジュールを読み込んだ上で、4 tests 中3件が assertion failure、1件が成功した。失敗は次の業務契約だった。

- `InvalidAppointmentState` を値として返さず例外を投げる
- `AppointmentNotFound` を値として返さず例外を投げる
- 予約なしを `InvalidAppointmentState` に潰し、`AppointmentNotFound` を運ばない

module resolution error、syntax error、暫定 `@ts-expect-error` はない。

### S3 GREEN

Commands:

```bash
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
```

Observed: S1〜S3 regression 3 files / 14 tests が成功し、typecheck は exit 0。状態不正時と予約未検出時は transition / store の呼出回数が0であることも確認した。

### S4 RED

Command: `pnpm exercise:04`

Observed: static import の実在モジュールを読み込んだ上で、4 tests / 4件が assertion failure になった。

- 固定 clock / ID generator が無視され、イベントが非決定的
- 単一 `store(event)` の呼出回数が0で dual-write が残る
- 保存後の戻り値が `void` になり aggregate state が残らない
- 失敗する単一 store が無視され、`RepositoryError` を返さない

### S4 GREEN / session-05 到達点

Commands:

```bash
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
```

Observed: S1〜S4 regression と in-memory adapter test の 5 files / 20 tests が成功し、typecheck は exit 0。固定 event context、単一 store、`andThrough` 後の aggregate state、保存失敗時の無変更を確認した。

## Review round 1 follow-up

- session-04 / session-05 の S3 Step 3 regression に、public `startExamination` へ予約未検出を入力する検証を追加した。
- 返却エラーが元の `appointmentId` を保持した `AppointmentNotFound` であり、`InvalidAppointmentState` へ潰れないことを確認した。
- session-04 は transition / save、session-05 は event context / store がいずれも0回で、失敗後の処理へ進まないことを確認した。
- session-04 normal test は 3 files / 14 tests、session-05 normal test は 5 files / 20 tests が成功した。各 package typecheck と root `pnpm typecheck`、`git diff --check` も exit 0。

## root scripts と exercise 契約

- `pnpm exercise:01`: intended RED、4 assertion failures (`Unused '@ts-expect-error' directive.`)
- `pnpm exercise:02`: intended RED、2 assertion failures / 2 passed
- `pnpm exercise:03`: intended RED、3 assertion failures / 1 passed
- `pnpm exercise:04`: intended RED、4 assertion failures
- root に `exercise:00` / `exercise:05` はない。
- session packages に `build` alias はない。S1〜S4 の typecheck は exercise と両 Vitest config を含む。

## 全体検証

- `pnpm install --offline --frozen-lockfile`: success
- `pnpm typecheck`: success。session-00〜05、docs、worker がすべて exit 0
- `pnpm test`: session-00〜05 はすべて成功。docs は 82 tests 中63 passed / 19 failed、加えて旧 `src/appointment.ts` を直接読む1 suite が import failure
- `pnpm build`: Astro check と client build は成功したが、static route 生成時に旧 `examples/session-00/src/appointment.ts` を参照して失敗
- `git diff --check`: success

docs の失敗はすべて Code Explorer / 旧 session ページが移動前の snapshot path を参照する既知の P1 phase-gate である。Task 2 時点の12件に加え、Task 3 で置き換えた S3〜S5 の旧 `src/application` / `src/ports` / `src/review` 等を参照する同種の失敗が現れ、現時点の実測は上記19 tests + 1 suite だった。Task 3 の変更禁止範囲に従い `apps/docs/**` は変更していない。controller が後続の docs path 同期で解消する。

## 差分境界

- 変更: `examples/session-03/**`, `examples/session-04/**`, `examples/session-05/**`, `package.json`, `pnpm-lock.yaml`, 本 report
- diff なし: `examples/final/**`, `apps/docs/**`, `worker/**`
- initial commit: `e5ddbb2 feat: Resultとイベントの演習スナップショットを再構築`
- review round 1 fix: この report と同じ commit
- push は実施していない。
