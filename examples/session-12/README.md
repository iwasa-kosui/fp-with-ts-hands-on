# Session 12: projection と event を原子的に保存する

開始状態です。Session 11 の解答として `StartExaminationUseCase` が resolver、guard、成功イベント、一つの store port を `ResultAsync` で合成します。しかし store が古い読み込み結果を無条件に保存すると、projection と監査 event の整合性は守れません。次の Session 13 が、この回の解答済み snapshot です。

## 事故

同じ受付済み予約を二人が読み、一方が先に更新した後でも他方の古い操作が成功すると、projection の上書きや事実と一致しない event が残ります。projection だけ、または event だけの保存も業務履歴を壊します。

## 守る不変条件

store は event が期待する直前の `CheckedIn` と現在状態が一致するときだけ、次の状態と event を一緒に確定します。不一致は `AppointmentConflict`、予期しない永続化失敗は `RepositoryError` として返し、どちらの場合も片方だけを変更しません。

## この回で変える関数

- `InMemoryAppointmentEventStore.store`
- `InMemoryAppointmentEventStore.create`

in-memory store は transaction の判断を小さく再現する教材です。SQLite、HTTP、同時実行制御の実装は追加しません。

## 検証と次の snapshot

```bash
pnpm --filter @fp-with-ts/clinic-session-12 typecheck
pnpm --filter @fp-with-ts/clinic-session-12 test
pnpm --filter @fp-with-ts/clinic-session-12 exercise
```

通常テストは use case の port 合成を確認します。演習は expected state を照合する atomic store がないため意図的に失敗します。Session 13 では stale state の失敗後も状態と event がどちらも変わらないことを確認します。
