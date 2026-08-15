# Session 04: 副作用を外に出す

このディレクトリは Session 04 の開始スナップショットです。S3 の `Result` 解答を保ったまま、非決定値と dual-write を観察します。解答は `examples/session-05/src` にあります。

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm --filter @fp-with-ts/clinic-session-04 exercise
```

`typecheck` と `test` は成功します。`exercise` は `Date` / `randomUUID` の直接呼び出しと、状態・監査記録の2回書き込みを業務名の assertion failure として再現します。
