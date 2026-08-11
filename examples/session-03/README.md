# Session 03: 状態ごとに必要な情報を表す

文字列の状態一覧を、`kind` を判別子にした予約済み・受付済み・診察中の状態へ置き換えます。各状態に必要な情報だけを必須にします。

```bash
pnpm --filter @fp-with-ts/clinic-session-03 typecheck
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm --filter @fp-with-ts/clinic-session-03 exercise
```

`typecheck` と `test` は成功します。`exercise` は次に扱う診察開始遷移を要求するため、意図的に失敗します。
