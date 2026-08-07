# Final: 動物病院の完成例

各セッションで扱った業務事故への対策を、一概念一ファイルの自己完結した完成例としてまとめています。状態を判別共用体、外部入力を Zod Standard Schema、予期可能な失敗を `Result`、用途の異なる UUID を branded type、連絡先を `Sensitive` で表します。状態と event は `save(state, events)` で一度に保存します。

電話フォローでは、候補配列全体を検証してから Paid・要フォロー・pet ID 一致の候補を抽出し、appointment ID 単位で重複を除きます。不正な候補が一件でもあれば、部分的な target や event は返しません。

```bash
pnpm --filter @fp-with-ts/clinic-final typecheck
pnpm --filter @fp-with-ts/clinic-final test
```
