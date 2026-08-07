# Session 00: 事故再現

これは Session 00 開始時点の、意図的に壊れやすい予約管理のスナップショットです。

`pnpm test` は予約から会計までの通常フローを確認し、成功します。
`pnpm exercise` は会計済みの来院を診察中へ戻せる事故を再現するため、意図的に失敗します。

```bash
pnpm --filter @fp-with-ts/clinic-session-00 test
pnpm --filter @fp-with-ts/clinic-session-00 exercise
```
