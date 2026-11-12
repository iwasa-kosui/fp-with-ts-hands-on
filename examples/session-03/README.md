# Session 03: 境界で入力を検証し、監査記録から個人情報を除外する

このディレクトリはSession 03の開始スナップショットです。解答は `examples/session-03-solution/src` にあります。

この開始スナップショットでは、AppointmentIdとVeterinarianIdが別の型として区別済みです。この2つのIDをHTTPの文字列から作る境界を実装します。変更対象は `src/adaptor/primary/web/startExaminationInput.ts` の1ファイルです。

```bash
pnpm demo:03
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
```

S03 の演習は、ブラウザの演習の画面で、誤った変更を検出する仕組みを足します。

デモは `http://localhost:3000` で起動します。診察開始routeは、path parameterの予約IDと外部から届く担当獣医師IDを `StartExaminationInput.parse` へ渡します。

`typecheck` と `test` は、S01 と S02 の回帰に加えて、AppointmentIdとVeterinarianIdを取り違えるとコンパイルできないことを確認します。

## 時間外の補足

`src/adaptor/primary/web/examResult.ts` と `src/adaptor/primary/web/ownerContact.ts` は時間内の変更対象ではありません。検査結果のschemaと個人情報（PII）のマスキングを比較したい場合は、解答側のsession-03-solutionと読み比べます。
