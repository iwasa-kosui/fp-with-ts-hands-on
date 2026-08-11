# Session 03: 状態遷移を型で閉じる

## 開始状態

状態名は固定できましたが、状態ごとに必要な情報や許可された遷移元は表せません。

## この回で変える関数

`kind` を判別子にした状態型を作り、`CheckedIn` からだけ診察を開始できるようにします。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-03 test
pnpm exercise:03
```

通常テストは状態固有の情報を確認し、演習は会計待ちがまだないため意図的に失敗します。

## 次の snapshot

Session 04 で診察完了と会計の間に `AwaitingPayment` を加えます。
