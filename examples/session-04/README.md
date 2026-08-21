# Session 04: 外部入力を境界で検証する

このディレクトリは Session 04 の開始スナップショットです。解答は `examples/session-05/src` にあります。

S3 の解答を保ったまま、`src/boundary/` で外部 JSON を検証し、飼い主の連絡先をログから守ります。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

`typecheck` と `test` は S2 と S3 の回帰を確認します。`exercise` は境界の業務上の不変条件で意図的に失敗します。
