# Session 04: 入力を検証し、監査記録から個人情報を除く

このディレクトリはSession 04の開始スナップショットです。解答は `examples/session-05/src` にあります。

S3で区別したAppointmentIdとVeterinarianIdをHTTP境界で検証し、不正な要求を保存処理より前で止めます。さらに、診察開始の監査記録と予約テーブルへ保存する情報を必要な項目だけに絞ります。

変更対象は次の5ファイルです。検証問題を保持する `src/shared/schemaResult.ts` は配布済みなので、読みますが変更しません。

- `src/boundary/startExaminationInput.ts`
- `src/web/routes.ts`
- `src/adaptor/secondary/sqlite/appointmentRepository.ts`
- `src/adaptor/secondary/sqlite/schema.ts`
- `drizzle/0000_initial.sql`

```bash
pnpm --filter @fp-with-ts/clinic-session-04 typecheck
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm exercise:04
pnpm demo:04
```

デモは `http://localhost:3000` で起動します。診察開始routeは、path parameterの予約IDと外部から届く担当獣医師IDを `StartExaminationInput.parse` へ渡します。

`typecheck` と `test` は開始スナップショットの通常動作、実ファイルSQLite、S2、S3の回帰を確認します。`exercise` はブラウザ内でも動くインメモリRepositoryでHTTP前後の状態と監査記録を観測し、Drizzle schemaとmigration SQLも検査します。7件中、正常入力の1件だけ成功し、入力検証、422と副作用停止、保存項目の最小化を確認する6件が意図的に失敗します。

JSONとして読み取れないHTTP本文の正規化は、この演習では扱いません。

`drizzle/0000_initial.sql` は本番運用中のmigrationではなく、Session 04の開始スナップショットです。演習前に `pnpm demo:04` を実行した場合、修正後の初期schemaは適用済みの `clinic.sqlite` へ再適用されません。デモを停止し、次のコマンドでSession 04のローカルDBを作り直してから再起動してください。予約状態と監査記録は初期状態へ戻り、削除したDBは復元されません。

```bash
pnpm demo:reset:04
pnpm demo:04
```

## 時間外の補足

`src/boundary/examResult.ts` と `src/boundary/ownerContact.ts` は時間内の変更対象ではありません。検査結果のschemaとPIIのマスキングを比較したい場合は、解答側のsession-05と読み比べます。
