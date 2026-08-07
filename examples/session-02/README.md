# Session 02: 型で状態遷移を閉じる

Session 01 で固定した「会計済みまたはキャンセル済みの来院を戻さない」という要求を、`kind` を判別子にした状態の判別共用体で表します。

`Appointment` の純粋な遷移関数は、遷移元の状態を引数の型で制限します。たとえば `startExamination` は `CheckedIn` だけを受け取り、`recordPayment` は `InExamination` だけを受け取ります。状態に必要な情報も、それぞれの状態型で必須です。

```bash
pnpm --filter @fp-with-ts/clinic-session-02 typecheck
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-02 exercise
```

`typecheck` と `test` は成功します。`exercise` は、次に扱う外部入力の検証、用途別 ID、PII のマスクを要求するため、境界用 source がまだ存在せず意図的に失敗します。この時点の ID は plain `string` であり、Zod と neverthrow は導入していません。
