# Session 05: 当日の到達点

S1〜S4 の解答と回帰テストを統合したスナップショットです。S3 の同期 `startExamination` は `Result` の契約を維持し、S4 の `startExaminationWithEffects` は `ResultAsync` と `andThrough` で効果を接続します。`Clock` と `EventIdGenerator` で非決定値を外へ出し、状態と監査記録を `store(event)` 1回で保存します。

adapter は診断用の `RepositoryFailure` と `cause` を保持しますが、use case 境界の `mapErr` は新しい `RepositoryError` を作ります。公開エラーへ生の例外や個人情報を出しません。

```bash
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
```
