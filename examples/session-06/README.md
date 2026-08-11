# Session 06: 外部入力を境界で検証する

## 開始状態

状態遷移は閉じましたが、外部から来る UUID と日時を信頼して業務モデルに渡しています。

## この回で変える関数

`StartExaminationInput.parse` を編集し、`unknown` な入力を型付きの検証結果へ変換します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-06 test
pnpm exercise:06
```

通常テストはキャンセル契約を確認し、演習は不正な UUID をまだ拒否できないため意図的に失敗します。

## 次の snapshot

Session 07 で、同じ primitive でも意味が異なる値を分けます。
