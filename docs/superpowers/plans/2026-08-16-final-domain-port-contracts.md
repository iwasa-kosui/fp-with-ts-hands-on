# Final Domain Port Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** final example の永続化・問い合わせ port 契約を domain module に集約します。

**Architecture:** port の型、discriminant、メソッドシグネチャは変更せず domain へ移します。use case と primary/secondary adapter の import path を新しい domain module に更新し、SQLite の具象実装は adapter 配下に維持します。

**Tech Stack:** TypeScript、neverthrow、Hono、Drizzle、Vitest

**Spec:** `docs/superpowers/specs/2026-08-16-final-domain-port-contracts.md`

## Global Constraints

- 対象は import path と契約配置だけです。HTTP、SQLite クエリ、業務ルール、Promise rejection の境界を変更しません。
- port 契約は domain から adapter、Drizzle、Hono、React を import しません。
- `InstallationStatus` の 2 状態、store/reader の引数・戻り値・error union を変更しません。
- 相対 import は `.js` suffix を維持します。
- `useCase/query` と `useCase/persistence` に旧契約ファイルを残しません。
- 型専用の配置テストは追加せず、既存の回帰テストと型検査で確認します。

---

### Task 1: domain module へ port 契約を移設する

**Files:**
- Create: `examples/final/src/domain/installation/installationStatusQuery.ts`
- Create: `examples/final/src/domain/installation/initialAdminSetupStore.ts`
- Create: `examples/final/src/domain/audit/eventHistoryReader.ts`
- Move: `examples/final/src/useCase/query/followUpRequestReader.ts` → `examples/final/src/domain/followUp/followUpRequestReader.ts`
- Delete: `examples/final/src/useCase/query/installationStatusQuery.ts`
- Delete: `examples/final/src/useCase/query/eventHistoryReader.ts`
- Delete: `examples/final/src/useCase/persistence/initialAdminSetupStore.ts`
- Modify: `examples/final/src/app.ts`
- Modify: `examples/final/src/useCase/setUpInitialAdminUseCase.ts`
- Modify: `examples/final/src/useCase/listEventsUseCase.ts`
- Modify: `examples/final/src/useCase/listFollowUpsUseCase.ts`
- Modify: `examples/final/src/useCase/requestFollowUpUseCase.ts`
- Modify: `examples/final/src/adaptor/primary/web/installationStatus.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/authRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/routes/dashboardRoutes.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/followUpRequestReader.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/installationStatusQuery.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/query/eventHistoryReader.ts`
- Modify: `examples/final/src/adaptor/secondary/sqlite/store/initialAdminSetupStore.ts`
- Modify: `examples/final/test/adaptor/sqliteResolver.test.ts`
- Modify: `examples/final/test/useCase/authenticationUseCases.test.ts`
- Modify: `examples/final/test/useCase/followUpUseCases.test.ts`

**Interfaces:**
- Consumes: `InitialAdminSetupStore`, `InstallationStatusQuery`, `EventHistoryReader`, `FollowUpRequestReader` の現在の export。
- Produces: 4 契約を domain path から import でき、旧 use case path に import が残らない状態。

- [ ] **Step 1: 既存の回帰テストを確認する**

配置だけを変えるため、期待する HTTP と業務振る舞いは既存の回帰テストで固定されています。移動前に対象テストを実行します。

Run: `pnpm --filter './examples/final' test -- test/web/authRoutes.test.ts test/useCase/authenticationUseCases.test.ts test/useCase/followUpUseCases.test.ts test/adaptor/sqliteResolver.test.ts`

Expected: PASS。新しい振る舞いは追加しません。

- [ ] **Step 2: port 契約を domain module へ移す**

現在の export 内容をそのまま domain path へ移します。契約は次の形を維持します。

```ts
export type InstallationStatus =
  | Readonly<{ kind: "InitialSetupAvailable" }>
  | Readonly<{ kind: "Installed" }>;

export type InstallationStatusQuery = Readonly<{
  get: () => ResultAsync<InstallationStatus, never>;
}>;
```

```ts
export type InitialAdminSetupStore = Readonly<{
  store: (
    userEvent: UserCreated,
    sessionEvent: SessionCreated,
  ) => ResultAsync<void, InitialAdminAlreadyExists>;
}>;
```

`FollowUpRequestReader` と audit reader も現在の型と `.js` suffix の domain import を維持します。SQLite、Hono、React の import は新しい domain files に追加しません。

- [ ] **Step 3: すべての consumer を新しい domain path へ更新する**

use case、`app.ts`、web adapter、SQLite adapter、テスト、Events ページの import を domain path へ更新します。`SetUpInitialAdminUseCase` の `InitialAdminAlreadyExists` re-export は domain path を re-export します。旧 `useCase/query` と `useCase/persistence` ファイルを削除します。

Run: `rg -n 'useCase/(persistence|query)' examples/final/src examples/final/test`

Expected: no matches。

- [ ] **Step 4: 型検査と回帰テストを実行する**

Run: `pnpm --filter './examples/final' typecheck && pnpm --filter './examples/final' test && git diff --check`

Expected: PASS。契約の import path 以外の振る舞い差分はありません。

- [ ] **Step 5: コミットする**

```bash
git add examples/final/src examples/final/test
git commit -m "refactor(final): move port contracts into domain"
```
