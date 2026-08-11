# Session 08: 意味の違う値を分ける

開始状態です。Schema を通っても ID、日時、金額はすべて primitive のままでは取り違えられます。この回では用途別の brand で `AppointmentId`、`PetId`、`OwnerId`、`VeterinarianId`、`Timestamp`、`PaymentAmount` を表します。次の Session 09 で、値の意味とは別に PII の出力を隠します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-08 typecheck
pnpm --filter @fp-with-ts/clinic-session-08 test
pnpm --filter @fp-with-ts/clinic-session-08 exercise
```

通常テストは ID の取り違えを型で防ぎ、不正な日時と金額を拒否することを確認します。演習は PII を文字列化したときの保護がまだないため意図的に失敗します。
