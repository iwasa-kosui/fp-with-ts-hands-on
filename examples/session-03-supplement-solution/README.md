# Session 03（補助演習）の解答

このディレクトリは Session 03 の補助演習の解答を含むスナップショットです。開始は `examples/session-03-supplement` にあります。

```bash
pnpm demo:03-supplement-solution
pnpm --filter @fp-with-ts/clinic-session-03-supplement-solution typecheck
pnpm --filter @fp-with-ts/clinic-session-03-supplement-solution test
```

デモは `http://localhost:3000` で起動します。診察開始routeは、path parameterの予約IDと外部から届く担当獣医師IDを `StartExaminationInput.parse` へ渡します。
