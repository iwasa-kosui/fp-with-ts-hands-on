# Session 05: キャンセルと終端状態を追加する

## 開始状態

診察完了から会計済みまでの状態は表せますが、通常キャンセルと終端状態はまだありません。

## この回で変える関数

`Appointment.cancel` と `Appointment.isTerminal` だけを追加します。キャンセルできるのは `Scheduled` または `CheckedIn` だけで、`Paid` と `Canceled` は終端状態です。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-05 test
pnpm exercise:05
```

通常テストは会計待ちから会計済みへの進行を確認します。`pnpm exercise:05` は、キャンセルと終端判定がまだないため意図的に失敗します。

## 次の snapshot

Session 06 で、キャンセル可能な状態を union の引数へ絞り、`Paid | Canceled` を終端状態として判定します。
