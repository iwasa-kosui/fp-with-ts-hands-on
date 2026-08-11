# Session 09: 予期可能な失敗を値にする

## 開始状態

PII は守れますが、見つからない予約を呼び出し側が判断できる失敗理由で返せません。

## この回で変える関数

`ensureFound` を編集し、未解決の予約を `AppointmentNotFound` の `Result` にします。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-09 test
pnpm exercise:09
```

通常テストは連絡先の非露出を確認し、演習は未解決予約をまだ typed error にできないため意図的に失敗します。

## 次の snapshot

Session 10 で、成功した状態変更だけをイベントにします。
