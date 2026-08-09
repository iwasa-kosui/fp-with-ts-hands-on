# Task 4 fix round 2 実装レポート

## 概要

Task 4 re-review round 1 の worker lifecycle Important に対応した。実SQLite contention、typed conflict、transaction atomicity、重複matrixを維持しながら、worker message待受と終了処理を明示的なtimeout内へ閉じ、異常時にもlock・worker・SQLite接続・一時directoryを回収する。

Task 4 のテスト基盤とSQLite接続型だけを変更し、Task 5 は先取りしていない。

## RED

先に `sqliteWorkerTestSupport.test.ts` を追加し、存在しないhelper APIに対して次をREDにした。

- 期待messageが来ないworkerを50ms以内でtimeout rejectする。
- 期待message前にcode 0で終了したworkerもrejectする。
- workerの`error`を元のerrorでrejectする。
- `messageerror`をrejectする。
- 正常release後のexit 0をboundedに待つ。
- exit timeout後にworker terminateをboundedに完了する。

最初の実行はhelper module未実装でsuite RED、message helper実装後は前半4件GREENとなった。その後に追加したshutdown 2件は `observeWorkerExit is not a function` でREDになり、終了監視とshutdown実装後にGREENとなった。

さらに、SQLite write lockを保持したprobeがmessage timeoutになったケースを追加し、finallyからrelease・rollback・close・directory削除まで完了することを確認した。

## worker message helper

`waitForWorkerMessage` は `message`、`messageerror`、`error`、`exit`、timeoutを一つの`settle`へ集約した。

- 期待messageだけをresolveし、それ以外のmessageは待受を継続する。
- 期待message前のexitはcode 0を含むすべてをrejectする。
- timeoutは呼出しごとの明示時間でrejectする。
- 最初のresolve/rejectだけが有効である。
- settle時にtimerと4種のlistenerをすべて除去する。

各probeはsettle後の `message` / `messageerror` / `error` / `exit` listener数が0であることを確認した。timeout probeは50ms設定に対して500ms未満でrejectし、Vitest外側timeoutへ依存しない。

## bounded exit と terminate

`observeWorkerExit` は作成直後からworkerの `exit` / `error` / `messageerror` を監視し、次の判別共用体を返す。

- `Exited { code }`
- `Failed { error }`
- `TimedOut { timeoutMilliseconds }`

`shutdownWorker` は必ずrelease callbackを先に実行する。exit 0ならそのまま完了し、timeout・error・messageerror・non-zero exitでは `terminateWorker` を呼ぶ。terminate自体にも個別timeoutがあり、timerをsettle時に除去する。

probeでは、Atomicsで停止したworkerがrelease後にexit 0となること、releaseを無視するworkerが50msのexit timeout後にbounded terminateされることを確認した。

## SQLite worker lifecycle

contention worker側はtransactionとdatabaseを `try/finally` で管理する。

- `BEGIN IMMEDIATE` 後に異常終了した場合、transactionが開いていればrollbackする。
- 成功commit後も失敗rollback後もdatabaseをcloseする。
- close後にworkerがexitする。

main側はworker、release signal、exit monitor、first/second SQLite connectionをtry外で保持する。finallyの順序は次のとおりである。

1. release signalを必ずstore/notifyする。
2. workerのexit 0をboundedに待ち、timeout/異常ならbounded terminateする。
3. second DB connectionをcloseする。
4. first DB connectionをcloseする。
5. 一時directoryを削除する。

正常contention testとtimeout lock-holder probeの両方で、directoryが残らないことを確認した。mainはworker exitまで待つため、worker側database closeより前にdirectoryを削除しない。

## contention 同期と固定待ち除去

従来の固定300ms待機を削除した。現在の順序は次のとおりである。

1. first workerが独立接続で `BEGIN IMMEDIATE` を取得し、成功側3表を未commitで書く。
2. first workerが `locked` を通知する。
3. mainは本番 `createAppointmentEventStore` のsecond storeを生成し、transaction microtaskをscheduleする。
4. mainがrelease signalを通知する。
5. first workerは固定時間ではなく次のevent-loop turnでcommitする。
6. secondは未commit lockへwrite試行し、解放後に同一transactionで重複queryを再評価する。
7. secondは `VeterinarianScheduleConflict` を返す。

secondをraw SQL workerとして複製すると本番storeのtransaction/queryを検証できなくなるため、secondはmain thread上の本番storeを維持した。固定時間に依存せず、store scheduleをreleaseより先に置いて試行順を明示している。

この同期形でcontention単体を5回反復し、すべて46–57msでPASSした。`busy_timeout = 0` の一時mutationでは同じtestが `RepositoryError { cause: SqliteError: database is locked }` でREDになったため、first commit後の単なる逐次queryではなく実lock contentionを通っている。mutationは `busy_timeout = 5000` へ復元し、production sourceには残していない。

## typed conflict、atomicity、matrix

secondは引き続き次のtyped errorを返す。

```text
VeterinarianScheduleConflict
appointmentId: second candidate
conflictingAppointmentId: first appointment
```

最終DBは成功側 `appointments` / `domain_events` / `domain_event_sensitive_payloads` が各1、regular payloadが0である。失敗側projection / event / sensitive payloadはcandidate appointment ID / event IDで各0を確認する。

半開区間、候補側null、既存側null、別担当医、自分自身除外、既存 `Scheduled | CheckedIn` のみ拒否するmatrix testも変更せずGREENを維持した。

## 型境界

Drizzle runtimeが公開する `$client` を `SqliteDatabase` 型へ明示し、test cleanupが型安全に `better-sqlite3` connectionをcloseできるようにした。runtime挙動やSQLite設定は変更していない。

## GREEN と全検証

- lifecycle helper probes: 7/7 PASS。
- 固定待ちなしcontention単体: 5回連続PASS。
- Task 4 focused: 6 files / 91 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final typecheck`: PASS。
- `pnpm --filter @fp-with-ts/clinic-final test`: 26 files / 258 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final build`: client / SSR / app artifact / built entry smoke PASS。
- `pnpm typecheck`: 全examples / docs / worker PASS。Astro diagnosticsはerror 0、warning 0、hint 0。
- `pnpm test`: 全examples / docs PASS。final 258 tests、docs 83 testsを含む。
- `pnpm build`: 全examples / docs PASS。docsは10 HTML / 10 internal routesを検証した。
- `git diff --check`: PASS。

## SHA

- fix開始 SHA: `3e3b8b79f5bce8b197b1f4267d7d03572c44c496`
- fix完了 SHA: 本レポートを含む別commitのため、commit後の完了応答に記載する。

## 残課題

- Task 4 re-review round 1 の worker lifecycle Important に対する未解決事項はない。
- Task 5 の受付ボード、受付メモ更新、前受金、最終精算、予約詳細拡張は未着手のまま維持した。
