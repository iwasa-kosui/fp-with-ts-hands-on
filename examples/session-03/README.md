# Session 03: 失敗を値にする

このディレクトリは Session 03 の開始スナップショットです。解答は `examples/session-04/src` にあります。

```bash
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

S2 の解答を保ったまま、次の演習では予期可能な失敗を Result として利用側へ返します。
