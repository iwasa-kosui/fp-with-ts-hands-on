# Session 04: 失敗を値にする

このディレクトリは Session 04 の開始スナップショットです。解答は `examples/session-05/src` にあります。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

S3 の解答を保ったまま、次の演習では予期可能な失敗を Result として利用側へ返します。
