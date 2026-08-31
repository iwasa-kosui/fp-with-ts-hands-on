# Session 04: 診察開始の入力を境界で検証する

このディレクトリはSession 04の開始スナップショットです。解答は `examples/session-05/src` にあります。

S3で区別したAppointmentIdとVeterinarianIdを、HTTPの文字列から作る境界を実装します。変更対象は `src/boundary/startExaminationInput.ts` の1ファイルです。

```bash
pnpm demo:04
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm exercise:04
```

デモは `http://localhost:3000` で起動します。診察開始routeは、path parameterの予約IDと外部から届く担当獣医師IDを `StartExaminationInput.parse` へ渡します。

`typecheck` と `test` はS2とS3の回帰を確認します。`exercise` は、不正な予約IDと不正な担当獣医師IDを拒否できない2件で意図的に失敗します。

## 時間外の補足

`src/boundary/examResult.ts` と `src/boundary/ownerContact.ts` は時間内の変更対象ではありません。検査結果のschemaとPIIのマスキングを比較したい場合は、解答側のsession-05と読み比べます。
