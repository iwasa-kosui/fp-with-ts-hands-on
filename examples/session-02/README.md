# Session 02: 状態の語彙を固定する

## 開始状態

Scheduled の予約値は作れますが、CheckedIn への受付遷移はまだ安全に表現できません。

## この回で変える関数

`Appointment.book` は提供済みの setup です。`Appointment.checkIn` の1関数だけを編集し、Scheduled から CheckedIn を作ります。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-02 test
pnpm exercise:02
```

通常テストは状態語彙と終端状態の要求を確認し、演習は `checkIn` が CheckedIn 遷移をまだ返せないため意図的に失敗します。

## 次の snapshot

Session 03 で `kind` を持つ状態型へ進みます。
