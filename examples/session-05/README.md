# Session 05: 当日の到達点

S1〜S4 の解答と回帰テストを統合したスナップショットです。`Clock` と `EventIdGenerator` で非決定値を外へ出し、状態と監査記録を `store(event)` 1回で保存します。

```bash
pnpm --filter @fp-with-ts/clinic-session-05 typecheck
pnpm --filter @fp-with-ts/clinic-session-05 test
```
