# Session 03: 値を型にする

このディレクトリは Session 03 の開始スナップショットです。解答は `examples/session-04/src` にあります。

S2 の解答を保ったまま、`src/boundary/` で外部 JSON、用途別 ID、PII を守ります。

```bash
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

`typecheck` と `test` は S2 の回帰を確認します。`exercise` は境界の業務上の不変条件で意図的に失敗します。
