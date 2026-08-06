# Session 04: Result、repository、domain event を追加する

Session 03 の状態、Zod による境界検証、用途別 UUID、PII 保護を引き継ぎます。診察開始で起きうる入力検証・予約未検出・不正な予約状態を neverthrow の `Result` と `kind` を持つエラーで返し、成功時だけ `ExaminationStarted` を記録します。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱う agent review の source がまだ存在しないため、意図的に失敗します。

この段階では repository の状態保存と event store への append は別操作です。また `eventId` と `occurredAt` は `string` のままです。両方とも次のレビューで扱う問題として意図的に残しています。
