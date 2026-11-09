# Session 03: 診察開始の入力を境界で検証する

このディレクトリはSession 03の開始スナップショットです。解答は `examples/session-03-solution/src` にあります。

S03の補助演習で区別したAppointmentIdとVeterinarianIdを、HTTPの文字列から作る境界を実装します。変更対象は `src/adaptor/primary/web/startExaminationInput.ts` の1ファイルです。

```bash
pnpm demo:03
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm exercise:03
```

デモは `http://localhost:3000` で起動します。診察開始routeは、path parameterの予約IDと外部から届く担当獣医師IDを `StartExaminationInput.parse` へ渡します。

`typecheck` と `test` はS01、S02、S03の補助演習の回帰を確認します。`exercise` は、不正な予約IDと不正な担当獣医師IDを拒否できない2件で意図的に失敗します。

## 時間外の補足

`src/adaptor/primary/web/examResult.ts` と `src/adaptor/primary/web/ownerContact.ts` は時間内の変更対象ではありません。検査結果のschemaと個人情報（PII）のマスキングを比較したい場合は、解答側のsession-03-solutionと読み比べます。
