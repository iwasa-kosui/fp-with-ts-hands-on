# Task 4 fix round 3 実装レポート

## 概要

Task 4 re-review round 2 の SQLite contention 同期に対応した。second の予約保存を main thread から独立した worker へ移し、TypeScript の本番 module を読み込んで `createAppointmentEventStore(...).store(...)` を直接実行するようにした。first、second、releaser の3 workerをbarrierで順序付けし、本番storeが未commitのwrite lockへ実際に書込みを試みた後でのみfirstを解放する。

Task 4のtest harnessと開発依存だけを変更し、本番store、domain、監査境界、Task 5領域は変更していない。

## RED

最初にTypeScript workerから本番 appointment store moduleをロードするprobeを追加した。`tsx` が未導入だったため、workerは `Cannot find package 'tsx'` で終了し、期待する `ready` より前の異常終了としてREDになった。`tsx` を開発依存へ追加した後、同probeはGREENになった。

次にsecondを本番store workerへ移し、firstの `locked`、second/releaserの `ready`、secondの `attempting` をbarrierにした。`busy_timeout = 0` へ一時mutationすると、同じtestは次の差分で必ずREDになった。

```text
Expected: VeterinarianScheduleConflict
Received: RepositoryError
operation: AppointmentEventStore.store
cause: database is locked
```

このmutationでは待機時間assertも満たさず、本番storeがfirstのwrite lock保持中に書込みを試みたことを確認した。設定は直ちに `busy_timeout = 5000` へ復元し、mutationはsourceへ残していない。

## GREEN

second workerは `worker_threads` の `execArgv: ["--import", "tsx"]` で起動し、テスト用のraw SQLではなく本番 `createSqliteDatabase` と `createAppointmentEventStore` をimportする。外部境界である `workerData` はZodでparseし、本番domain constructorから予約eventを作ってstoreへ渡す。

復元後はsecondが100ms以上の明確な待機を経て、次のtyped domain errorを返した。

```text
VeterinarianScheduleConflict
appointmentId: second candidate
conflictingAppointmentId: first appointment
```

main threadを200ms同期的にdescheduleする反証probeをtest本体へ含めてもGREENになった。したがってmain threadのmicrotask順や固定sleep後の逐次実行には依存していない。同じcontention testを独立processで5回反復し、5/5 PASSした。

## 3-worker同期

順序は次のbarrierで固定した。

1. first workerが独立SQLite接続で `BEGIN IMMEDIATE` を取得し、成功側のprojection、event metadata、機微payloadを未commitで書き、`locked` を通知する。
2. second workerが本番DB/store moduleをロードして接続を開き、`ready` を通知してstart signalを待つ。
3. releaser workerも `ready` を通知し、secondのattempt signalを待つ。
4. mainがsecondのstart signalを通知する。
5. secondがattempt signalと `attempting` を通知した直後、本番 `store` を呼ぶ。
6. releaserはattempt signalを観測してから別thread上で100ms待ち、firstのrelease signalを通知する。
7. firstがcommitし、SQLiteのbusy waitから戻ったsecondが同一store transaction内の重複queryを再評価する。
8. secondはtyped schedule conflictを結果fileへ書き、DBをcloseしてexitする。

secondが同期 `better-sqlite3` 呼出しで待機している間も、releaserは別workerなのでfirstを解放できる。mainを200ms停止してもこの順序は変わらない。

## worker lifecycle と cleanup

round 2で追加したbounded helperの7 probesを維持し、本番TypeScript module load probeを加えた8/8をGREENにした。

- message待受は `message` / `messageerror` / `error` / `exit` / timeoutを単一settleで扱い、settle時にlistenerとtimerを除去する。
- firstはtransactionとdatabaseを `try/finally` で管理し、異常時rollback、成功時commit、その後closeする。
- secondは本番store実行を `try/finally` で囲み、成功・失敗のどちらでもdatabaseをcloseする。
- mainはfirst、second、releaserのworker・signal・exit monitorをtry外で保持する。
- finallyでは各blocked signalを必ず解放し、exit 0をboundedに待つ。timeout、worker error、messageerror、non-zero exitではterminateもboundedに行う。
- 3 workerの終了と全SQLite接続のclose後にだけ一時directoryを削除する。

正常contentionではfirst、second、releaserのexit codeがすべて0であることをassertし、test完了後にdirectoryが存在しないことも確認した。

## atomicity と重複matrix

contention後の最終状態は成功側をIDで識別して次の件数を確認した。

- `appointments`: 成功側1件、失敗側0件。
- `domain_events`: 成功側1件、失敗側0件。
- `domain_event_sensitive_payloads`: 成功側1件、失敗側0件。
- 通常payload: 0件。

既存の半開区間matrixもGREENを維持した。同じ担当医の `Scheduled | CheckedIn` のみ重複を拒否し、候補側vet `null`、既存側vet `null`、別vet、終了時刻と開始時刻が一致する境界、非対象status、自分自身のeditは許可する。競合時のtyped errorと3表のtransaction atomicityに退行はない。

## 全検証

- TypeScript worker production module probe: PASS。
- lifecycle helper probes: 8/8 PASS（round 2の7件を全保持）。
- real contention単体: main 200ms deschedule込みで5回連続PASS。
- Task 4 focused: 6 files / 92 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final typecheck`: PASS。
- `pnpm --filter @fp-with-ts/clinic-final test`: 26 files / 259 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final build`: client / SSR / app artifact / built entry smoke PASS。
- `pnpm typecheck`: 全examples / docs / worker PASS。Astro diagnosticsはerror 0、warning 0、hint 0。
- `pnpm test`: 全examples / docs PASS。final 259 tests、docs 83 testsを含む。
- `pnpm build`: 全examples / docs PASS。docs static build verificationもPASS。
- `git diff --check`: PASS。

## SHA

- fix開始 SHA: `ed2865035fbedce4c0ac21c66265a483cc964a2d`
- fix完了 SHA: 本レポートを含む別commitのため、commit後の完了応答に記載する。

## 残課題

- Task 4 re-review round 2 の実contention同期に対する未解決事項はない。
- Task 5 の受付ボード、受付メモ更新、前受金、最終精算、予約詳細拡張は未着手のまま維持した。
