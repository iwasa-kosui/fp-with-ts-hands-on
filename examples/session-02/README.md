# Session 02: 状態の語彙を固定する

事故を減らす前に、予約で使う状態を `Scheduled`、`CheckedIn`、`InExamination` として揃えます。まだ遷移を型では閉じません。

```bash
pnpm --filter @fp-with-ts/clinic-session-02 typecheck
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm --filter @fp-with-ts/clinic-session-02 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱う状態ごとの情報を持つ予約モデルを要求するため、意図的に失敗します。
