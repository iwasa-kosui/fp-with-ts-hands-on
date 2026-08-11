# Session 04: 会計待ちを表す

## 開始状態

診察開始の遷移は閉じましたが、診察完了と支払い済みの間にある業務状態がありません。

## この回で変える関数

`completeExamination` と `recordPayment` により、`AwaitingPayment` を経由する会計フローを追加します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-04 test
pnpm exercise:04
```

通常テストは会計待ちを確認し、演習はキャンセル状態がまだないため意図的に失敗します。

## 次の snapshot

Session 05 でキャンセルと終端状態を分けます。
