# fp-with-ts-hands-on

関数型ドメインモデリングハンズオン with TypeScript の example とドキュメントサイトです。

## セットアップ

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` のあと、表示された localhost URL を開いてください。

## 当日の流れ

1. 壊れやすい動物病院アプリを読む
2. 事故テストを赤くして不変条件を確認する
3. Discriminated Union で状態遷移を閉じる
4. 新たに発覚した外部入力事故と PII ログ漏えいを、Zod と Branded Type で守る
5. 失敗理由を Result 型で返し、成功した状態変更をドメインイベントとして記録する
6. AI エージェントに次の追加要求を頼む前提でレビューする
