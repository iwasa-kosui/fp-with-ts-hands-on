# Session 05: レビューで見つけた境界と保存の問題を閉じる

Session 04 の状態遷移、境界検証、用途別 UUID、`Result`、domain event を引き継ぎます。レビューで見つかった state と event の dual-write を `save(state, events)` にまとめ、event ID と時刻を branded type として検証します。`Sensitive` は JSON、文字列、Node.js の `inspect` で連絡先をマスクします。

```bash
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm --filter @fp-with-ts/clinic-session-05 exercise
```

`typecheck` と `test` は成功します。`exercise` は電話フォロー対象の抽出 source がまだ存在しないため、意図的に失敗します。次の演習では、検査結果と予約の pet ID が一致する候補だけを集め、連絡先を公開せずにフォローイベントを組み立てます。
