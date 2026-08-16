# Session 06: ラボ結果到着

S2〜S5 の解答と回帰テストを統合した、ラボ結果到着後の非公開スナップショットです。S4 の同期 `startExamination` は `Result` の契約を維持し、S5 の `startExaminationWithEffects` は `ResultAsync` と `andThrough` で効果を接続します。`Clock` と `EventIdGenerator` で非決定値を外へ出し、状態と監査記録を `store(event)` 1回で保存します。

adapter は診断用の `RepositoryFailure` と `cause` を保持しますが、use case 境界の `mapErr` は新しい `RepositoryError` を作ります。公開エラーへ生の例外や個人情報を出しません。

```bash
pnpm --filter @fp-with-ts/clinic-session-06 typecheck
pnpm --filter @fp-with-ts/clinic-session-06 test
```
