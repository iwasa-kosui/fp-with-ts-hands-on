# Session 04: 失敗を値にする

このディレクトリは Session 04 の開始スナップショットです。解答は `examples/session-04-solution/src` にあります。

```bash
pnpm demo:04
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
```

S04 の演習は、ブラウザの演習の画面で、誤った変更を検出する仕組みを足します。`pnpm exercise:04` は以前の演習のコマンドで、この回では使いません。

デモは `http://localhost:3000` で起動します。診察開始routeは複数の例外を投げますが、Web側は予約なしだけを文言でcatchするため、状態不正は500になります。

S03の解答として、診察開始routeは `StartExaminationInput.parse` を通った予約IDと担当獣医師IDだけをユースケースへ渡します。そのうえで、次の演習では予約なしと状態不正をResultとして利用側へ返します。
