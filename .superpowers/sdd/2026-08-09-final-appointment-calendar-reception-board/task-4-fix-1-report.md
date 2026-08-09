# Task 4 fix round 1 実装レポート

## 概要

Task 4 独立レビューの Important 1 に対応し、同一 JavaScript thread の `Promise.all` だった並行登録テストを、独立した `worker_threads` SQLite 接続が実際に write lock を保持する contention テストへ置き換えた。現行の `busy_timeout = 5000` と `behavior: "immediate"` は実 contention に対して正しく機能していたため、production code の変更は不要だった。

Task 4 の予約登録・変更・担当医再割当・飛び込み受付だけを対象とし、Task 5 は先取りしていない。

## 変更内容

- first worker が独立した `better-sqlite3` 接続で `BEGIN IMMEDIATE` を実行し、成功側の appointment projection、domain event、sensitive payload を同一 transaction 内へ書き込む fixture を追加した。
- first worker は lock 取得と未commit書込みの完了を main thread へ通知する。
- main thread は通知後に second 側の本番 `createAppointmentEventStore` を別SQLite接続で実行する。first worker は second 開始通知後も300ms lockを保持してから commitする。
- second は本番storeの `BEGIN IMMEDIATE` で待機し、lock解放後に同じtransaction内の重複queryを再評価して `VeterinarianScheduleConflict` を返すことを確認する。
- 成功側と失敗側を appointment ID / event ID で識別し、projection・監査event・payloadのatomicityを確認する。
- 重複matrixに「既存側担当医 `null`」と「別担当医」を追加した。

## contention の実行順

1. first worker の独立接続が `BEGIN IMMEDIATE` でwrite lockを取得する。
2. first worker が成功側 appointment / domain event / sensitive payload を未commitで書き込む。
3. first worker が `locked` を通知する。
4. main thread がrelease signalを通知し、直後にsecond接続の本番storeへ重複予約を渡す。
5. first workerはsignal受信後も300ms lockを保持する。secondはこの間にwrite lock取得を試行し、`busy_timeout`で待機する。
6. first workerが別threadからcommitする。
7. secondの`BEGIN IMMEDIATE`が進み、同じtransaction内の重複queryがcommit済みfirstを検出する。
8. secondは `VeterinarianScheduleConflict` でrollbackする。

GREEN実行ではsecondの所要時間が414–554msで、200ms以上待機したことを継続して確認した。後述の`busy_timeout = 0` mutationでは約1msで `SQLITE_BUSY` が返ったため、GREEN時の待機は単なる逐次実行ではなく実lock contentionによるものと判別できる。

## RED mutation

production sourceへmutationを残さず、次の手順でテストの破壊検出能力を確認した。

- 一時的に `createSqliteDatabase` の `busy_timeout = 5000` を `busy_timeout = 0` へ変更した。
- 実contention focused testを実行した。
- 期待した `VeterinarianScheduleConflict` に対し、実際は約1msで次のエラーとなりREDになった。

```text
RepositoryError
operation: AppointmentEventStore.store
cause: SqliteError: database is locked
```

- mutationを直ちに `busy_timeout = 5000` へ戻した。
- 同じtestを再実行し、434ms待機後の `VeterinarianScheduleConflict` でGREENへ戻ることを確認した。

このmutationは、`busy_timeout` の無効化またはfirstのlock保持時間より短い値への回帰を検出する。加えて、secondがfirstのcommit前に実際にwrite lock取得を試みた証拠にもなる。`behavior: "deferred"` へ変更した場合も、firstを見ないread snapshotからwriteへ昇格する際に `SQLITE_BUSY` となり、typed conflictのassertでREDになる構造である。

## 重複判定マトリクスの補強

| 既存側担当医 | 候補側担当医 | 時間帯 | 結果 |
| --- | --- | --- | --- |
| 同一担当医 | 同一担当医 | 重複 | `VeterinarianScheduleConflict` |
| 同一担当医 | 同一担当医 | 境界一致 | 許可 |
| 同一担当医 | `null` | 重複 | 許可 |
| `null` | 担当医あり | 重複 | 許可 |
| 担当医A | 担当医B | 重複 | 許可 |
| 同一appointment | 同一担当医 | edit後に重複 | 自分自身を除外して許可 |

## transaction atomicity

実contention完了後のfile SQLiteを確認した。

| 対象 | 成功側 | 失敗側 |
| --- | ---: | ---: |
| `appointments` projection | 1 | 0 |
| `domain_events` | 1 | 0 |
| `domain_event_sensitive_payloads` | 1 | 0 |
| `domain_event_payloads` | 0 | 0 |

成功側は appointment ID / event ID、失敗側は candidate appointment ID / event ID で個別にassertした。失敗側にはprojection、監査metadata、機微payloadのいずれも残らない。成功側の全文payloadは従来どおりsensitive tableだけに1件保存される。

## GREEN と全検証

- 実contention focused単体: PASS。現行構成で414–554ms待機後にtyped conflict。
- Task 4 focused: 5 files / 84 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final typecheck`: PASS。
- `pnpm --filter @fp-with-ts/clinic-final test`: 25 files / 251 tests PASS。
- `pnpm --filter @fp-with-ts/clinic-final build`: client / SSR / app artifact / built entry smoke PASS。
- `pnpm typecheck`: 全examples / docs / worker PASS。Astro diagnosticsはerror 0、warning 0、hint 0。
- `pnpm test`: 全examples / docs PASS。final 251 tests、docs 83 testsを含む。
- `pnpm build`: 全examples / docs PASS。docsは10 HTML / 10 internal routesを検証した。
- `git diff --check`: PASS。

## SHA

- fix開始 SHA: `618d4aa4cff9c4405957ece5f4b45bd11adcbb53`
- fix完了 SHA: 本レポートを含む別commitのため、commit後の完了応答に記載する。

## 残課題

- Task 4 review Important 1 に対する未解決事項はない。
- Task 5 の受付ボード、受付メモ更新、前受金、最終精算、予約詳細拡張は未着手のまま維持した。
