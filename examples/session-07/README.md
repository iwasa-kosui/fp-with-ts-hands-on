# Session 07: 外部入力を検証する

開始状態です。`unknown` の外部入力は TypeScript の注釈だけでは信用せず、Schema で一方向に変換します。この回では `schemaResult` と `StartExaminationInput.parse` を追加します。次の Session 08 で、同じ `string` でも ID の意味を区別します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-07 typecheck
pnpm --filter @fp-with-ts/clinic-session-07 test
pnpm --filter @fp-with-ts/clinic-session-07 exercise
```

通常テストは不正な UUID と日時を `SchemaValidationError` として拒否することを確認します。演習は ID の意味をまだ区別できないため意図的に失敗します。
