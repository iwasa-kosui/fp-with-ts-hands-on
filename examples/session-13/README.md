# Session 13: 安全な follow-up を統合する

## 開始状態

原子保存はできますが、電話 follow-up で認可、重複防止、PII 非露出をまとめて判断する入口がありません。

## この回で変える関数

`collectFollowUpTargets` と `RequestFollowUpUseCase.run` を編集します。この Session 内で演習を green にします。

## 検証

```bash
pnpm --filter @fp-with-ts/clinic-session-13 test
pnpm exercise:13
```

通常テストは原子性を確認し、演習は follow-up の対象収集、認可、重複 claim、PII 非露出が未実装のため意図的に失敗します。

## 次の snapshot

`examples/final` は read-only の比較用アーキテクチャツアーです。Session 13 のローカル starter と source-compatible ではありません。事故から domain、use case、store、web の順に比較して、設計上の判断を説明します。
