# Session 09: PII を出力境界で守る

開始状態です。brand は値の意味を守りますが、出力時の秘匿性は守りません。この回では `Sensitive.of` と `OwnerContact.parse` を追加し、電話番号を JSON、文字列、Node inspect から隠します。次の Session 10 で、検証以外の予期可能な失敗を値として区別します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-09 typecheck
pnpm --filter @fp-with-ts/clinic-session-09 test
```

通常テストは PII が出力に現れず、`PetId` を `OwnerId` に取り違えられないことを確認します。
