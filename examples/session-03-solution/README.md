# Session 03 の解答

このディレクトリは Session 03 の解答を含むスナップショットです。開始は `examples/session-03` にあります。

```bash
pnpm demo:03-solution
pnpm --filter @fp-with-ts/clinic-session-03-solution typecheck
pnpm --filter @fp-with-ts/clinic-session-03-solution test
```

デモは `http://localhost:3000` で起動します。診察開始routeは複数の例外を投げますが、Web側は予約なしだけを文言でcatchするため、状態不正は500になります。

S03の解答として、診察開始routeは `StartExaminationInput.parse` を通った予約IDと担当獣医師IDだけをユースケースへ渡します。そのうえで、次の演習では予約なしと状態不正をResultとして利用側へ返します。
