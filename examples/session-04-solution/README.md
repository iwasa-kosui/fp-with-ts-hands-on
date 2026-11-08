# Session 04 の解答

このディレクトリは Session 04 の解答を含むスナップショットです。開始は `examples/session-04` にあります。

```bash
pnpm demo:04-solution
pnpm --filter @fp-with-ts/clinic-session-04-solution typecheck
pnpm --filter @fp-with-ts/clinic-session-04-solution test
```

デモは `http://localhost:3000` で起動し、`startExaminationWithEffects` の非決定値と2回書き込みを実際のrouteから実行します。
