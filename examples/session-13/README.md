# Session 13: 権限と安全な出力を follow-up へ統合する

開始状態です。Session 12 の解答として、in-memory store は stale state を `AppointmentConflict` にし、projection と event を両方保存するか両方保存しないかを一つの操作で決めます。最後の演習では、電話 follow-up の対象収集と依頼の責務を分けます。

## 事故

対象収集で監査 event まで作ると、操作者の認可前に事実が作られ、OwnerContact が event payload へ混入しやすくなります。重複 claim を確認しない依頼は、同じ飼い主への電話を重複させます。

## 守る不変条件

`collectFollowUpTargets` は対象だけを返し、event を作りません。`OwnerContact` は認可された read-model 経路だけに残します。`RequestFollowUpUseCase.run` が操作者を認可し、既存 claim を確認し、識別子だけの `FollowUpRequested` を作って一つの store port へ渡します。

## この回で変える関数

- `collectFollowUpTargets`
- `RequestFollowUpUseCase.run`

この小さな snapshot は SQLite、HTTP、通知送信を実装しません。`examples/final` は各判断を統合した参照実装であり、この演習 package のコピー先ではありません。

## 検証と次の snapshot

```bash
pnpm --filter @fp-with-ts/clinic-session-13 typecheck
pnpm --filter @fp-with-ts/clinic-session-13 test
pnpm --filter @fp-with-ts/clinic-session-13 exercise
```

通常テストは atomic store の競合時に状態と event の両方が変わらないことを確認します。演習は follow-up の target、認可、重複 claim、PII 非露出の契約が未実装なので意図的に失敗します。次は `examples/final` を事故から domain、use case、store、web の順に読みます。
