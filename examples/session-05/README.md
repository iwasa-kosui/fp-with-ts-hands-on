# Session 05: 失敗を値にする

このディレクトリは Session 05 の開始スナップショットです。解答は `examples/session-06/src` にあります。

```bash
pnpm demo:05
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm --filter @fp-with-ts/clinic-session-05 exercise
```

デモは `http://localhost:3000` で起動し、診察開始routeがこのsnapshotの `Result` を固定noticeへ変換します。

S4 の解答を保ったまま、次の演習では予期可能な失敗を Result として利用側へ返します。
