# Session 05: 失敗を値にする

このディレクトリは Session 05 の開始スナップショットです。解答は `examples/session-06/src` にあります。

```bash
pnpm demo:05
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm exercise:05
```

デモは `http://localhost:3000` で起動します。診察開始routeは複数の例外を投げますが、Web側は予約なしだけを文言でcatchするため、状態不正は500になります。

S4の解答として、診察開始routeは `StartExaminationInput.parse` を通った予約IDと担当獣医師IDだけをユースケースへ渡します。そのうえで、次の演習では予約なしと状態不正をResultとして利用側へ返します。
