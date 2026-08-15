# S4 post-audit repair report

実施日: 2026-08-16（Asia/Tokyo）

対象基点: `c7d18eda148fdd59a34c016efc53b307be958966`

## 結果

- S3の同期 `startExamination` と `Result` 回帰をsession-04/05で維持した。
- S4のweak starter/solutionを同名 `startExaminationWithEffects` に揃え、solutionは `ResultAsync` / `andThrough` / single `store(event)` にした。
- `Appointment.startExamination(context)(checkedIn, veterinarianId)` companionをsession-04へ事前配布し、session-05とbyte-identicalにした。participant module外の04→05差分は0である。
- adapterはcause付きの内部 `RepositoryFailure` を返し、use case境界の `mapErr` は新しいcauseなし `RepositoryError` plain objectを作る。公開エラーJSONに生の例外、ownerName、email、phoneは含まれない。
- catalogのS4解答は、各targetの次snapshot同一相対pathをimport込みで1行目から末尾まで表示する `completed-file` とした。完成例は後続stepを含み、全target file反映後に同じexerciseをGREENにすることを明示した。S1〜S3は既定の `excerpt` を維持する。
- overlayはcompleted-file集合と対象集合の完全一致を検査し、target/solutionのcatalog pathがroot外へ出るtraversalを拒否する。

## TDD evidence

### RED

最初に `apps/docs/src/test/examples/s4-fallback-overlay.test.ts` を追加した。session-04を一時複製し、catalogのS4全targetについて次snapshotの同一相対pathだけをfull fileでoverlayした結果、修正前は次の理由でREDになった。

- `startExaminationWithEffects` のexport名が一致しない
- `Appointment.startExamination` companionがsession-04にない
- session-05の `startExamination` が非同期化され、S3同期回帰が壊れる
- starterとsolutionのstore dependencyが一致しない

session-05の回帰・エラー境界テストも先に変更し、S3同期API欠落、adapterの内部失敗型欠落、公開エラーのcause/PII露出をREDとして確認した。

review round 1では次のREDを追加確認した。

- S4 solutionが `completed-file` でなく、rangeが実ファイル全体でない: catalog / StepSolution 4件RED
- `examples/session-04/../outside` と `examples/session-05/../outside` を許す: traversal 2件RED
- `toRepositoryError` が `{ ...failure, kind: "RepositoryError" }` でcauseを復元するmutation: 到達点1件RED。PII、固有error message、stackがfailure差分に現れた

### GREEN

- S4 full-file overlay: typecheck成功、通常回帰3 files / 14 tests、同じexercise 1 file / 4 testsがすべてGREEN
- session-04 normal: 3 files / 14 tests、typecheck成功
- session-05 normal: 5 files / 21 tests、typecheck成功
- catalog / StepSolution / range / budget / overlay targeted: completed-file表示、対象集合一致、traversal拒否を含めて成功
- starter RED: S1/S2/S3/S4 = 4/2/3/4 failures、すべて業務名付き `AssertionError`、module resolution / syntax failureなし
- Step 4はfake storeの内部causeにownerName/email/phone/固有error message/stackを持たせ、公開エラーexact match、`cause` propertyなし、JSON非露出を同じ1 testで検証する。adapter内部causeは `toBe` で参照同一性を確認する

docs buildの初回再実行では、`sessions as const` の異種tupleを直接 `flatMap` したテストコードで、callbackの引数型を1つのstepへ狭める型エラーを検出した。`ExerciseStep` / `SolutionReference` へ明示的にwidenする収集関数へ直し、型アサーションなしで再実行した結果、Astro 70 files、0 diagnostics、8 routesで成功した。

## 差分予算

`git diff --no-index --unified=0` 相当の追加・変更後行から、空行とコメントのみの行を除いた実測値である。

| Exercise | Files | Effective lines | Limit | Result |
| --- | ---: | ---: | ---: | --- |
| S1 | 2 | 35 | 5 / 80 | PASS |
| S2 | 2 | 24 | 5 / 80 | PASS |
| S3 | 3 | 77 | 5 / 80 | PASS |
| S4 | 3 | 72 | 5 / 80 | PASS |

上限は変更していない。

## 最終検証

- `pnpm --filter @fp-with-ts/clinic-session-04 test`: 3 files / 14 tests成功
- `pnpm --filter @fp-with-ts/clinic-session-04 typecheck`: 成功
- `pnpm --filter @fp-with-ts/clinic-session-05 test`: 5 files / 21 tests成功
- `pnpm --filter @fp-with-ts/clinic-session-05 typecheck`: 成功
- `pnpm --filter @fp-with-ts/docs test`: 24 files / 146 tests成功
- `pnpm --filter @fp-with-ts/docs build`: Astro 70 files / 0 diagnostics、8 HTML / 8 routes成功
- `pnpm typecheck`: session-00〜05、docs、Worker成功
- `pnpm test`: session通常51 tests、docs 146 tests、明示Worker 30 tests成功
- `pnpm build`: Astro 70 files / 0 diagnostics、8 HTML / 8 routes成功
- session-04/05のdomain companion diff: 0
- `examples/final/**` の基点差分: 0
- `git diff --check`: 成功

既知のchunk-size warningは従来どおり出るが、build結果とroute検査は成功している。

## NEEDS_CONTEXT

設計・API・実装上の `NEEDS_CONTEXT` はない。自動検証で確認できないため残すのは、エージェントを使わない参加者がS4の全target完成ファイルを8〜10分で反映できるかというhuman apply timeだけである。
