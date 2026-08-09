# Task 6 report: フォローアップと監査イベント

## 実装

- フォローアップを `DataTable` と選択数を伝える一括操作領域で表示し、既存の `appointmentIds`、依頼済み/処理中の無効化、送信先、`forceFormData` を維持した。
- 依頼状況を `StatusBadge` で表示し、空状態と操作上の注意を既存の `EmptyState` / `InlineAlert` で表示した。
- 監査イベントを、個人情報を表示しないことと履歴保持を明記した `InlineAlert` と、アクセシブルな `DataTable` で表示した。
- 監査フィールドは scalar-only の `SanitizedAuditValue` を受ける `dl.audit-fields` に限定し、raw JSON、展開、コピー機能を追加していない。

## changed

- `examples/final/src/adaptor/primary/web/pages/FollowUps/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- `examples/final/src/adaptor/primary/web/styles.css`
- `examples/final/test/web/operatorConsolePages.test.tsx`

## RED

- `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts test/web/clinicFlow.test.ts`
- 新規のフォローアップ/監査一覧テストが、追加前のアクセシブルなテーブルラベル欠如により 2 件失敗した。既存の security boundary と follow-up persistence / request conflict テストは成功した。

## GREEN

- focused tests: 3 files / 21 tests passed。
- `pnpm --filter @fp-with-ts/clinic-final typecheck` passed。
- `git diff --check` passed。

## self-review

- CSS のクラス名・実装文字列ではなく、ARIA、操作領域、選択数、無効化、依頼状態、監査 DTO の可視データ境界をテストした。
- route、page props、domain、auth の契約は変更していない。
- `apps/docs/.astro/` には触れていない。

## concerns

- SSR テストでは選択後のクライアント状態遷移を直接操作できないため、初期選択数と submit の無効化、および既存の route-level persistence/conflict テストで境界を確認した。
