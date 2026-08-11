# Session 12: 原子性と競合を守る

## 開始状態

use case は port を合成できますが、古い読み込み結果で projection と event がずれる可能性があります。

## この回で変える関数

`InMemoryAppointmentEventStore.create` と `InMemoryAppointmentEventStore.store` を編集し、期待状態を照合してから状態と event を一緒に保存します。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-12 test
pnpm exercise:12
```

通常テストは use case port を確認し、演習は stale state をまだ conflict にできないため意図的に失敗します。

## 次の snapshot

Session 13 で、認可済みの follow-up 依頼へ安全性を統合します。
