# Session 05: キャンセルと終端状態を分ける

## 開始状態

会計待ちと支払い済みは表せますが、通常フローに戻せないキャンセルがありません。

## この回で変える関数

`Appointment.cancel` と `Appointment.isTerminal` を追加し、キャンセル可能な状態と終端状態を区別します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm exercise:05
```

通常テストは会計フローを確認し、演習はキャンセル契約がまだないため意図的に失敗します。

## 次の snapshot

Session 06 で、外部入力を業務モデルへ渡す境界を検証します。
