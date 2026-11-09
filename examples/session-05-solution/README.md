# Session 05 の演習用スナップショット

このディレクトリは、Session 05 のブラウザの演習で使うスナップショットです。参加者は業務のコードを編集せず、`exercises/guard/mine/` のテストと `eslint.config.mjs` のルールで、誤った変更を検出します。

```bash
pnpm --filter @fp-with-ts/clinic-session-05-solution typecheck
pnpm --filter @fp-with-ts/clinic-session-05-solution test
node packages/exercise-guard/src/cli.mjs verify --root examples/session-05-solution
```
