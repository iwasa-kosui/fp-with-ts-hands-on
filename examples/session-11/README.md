# Session 11: 成功した変更をイベントにする

解答済みのスナップショットです。Session 10 の型付き失敗を保ったまま、診察開始に成功したときだけ、状態変更を表すイベントを純粋に組み立てます。次の Session 12 で、このイベントを非同期の use case と保存へつなげます。

## 事故

成功した操作と失敗した操作を同じ「記録」として扱うと、何が実際に変更されたのかを追跡できません。

## 守る不変条件

`AppointmentExaminationStarted` は、`CheckedIn` から `InExamination` への成功した遷移だけを表します。失敗は `StartExaminationError` として返すだけで、イベントにはしません。

## 採用する技法と限界

イベントは変更後の `aggregateState`、安定した `eventName`、必要な ID の payload を持つ純粋な値です。これは読み込み、保存、非同期処理、競合の防止、認可を扱いません。

## 検証と振り返り

```bash
pnpm --filter @fp-with-ts/clinic-session-11 typecheck
pnpm --filter @fp-with-ts/clinic-session-11 test
```

通常テストは、診察開始で `InExamination` を持つ成功イベントだけを組み立てることを確認します。自分の業務で、状態変更に成功した事実として残すべきものを一つ探してください。
