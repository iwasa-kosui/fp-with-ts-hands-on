# Session 04 Boundary Storyline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Session 04を、診察開始入力の検証、HTTP 422での停止、監査データの最小化を一件の事故調査として学ぶ演習へ変更します。

**Architecture:** Session 04には意図的に問題を残した開始状態と失敗する演習テストを置き、Session 05以降には解決済みの回帰条件を置きます。HTTP要求の本文を実際に境界へ通し、検証失敗では保存処理の前に422を返します。監査記録は予約全体ではなく、用途別の小さなデータへ変換して保存します。

**Tech Stack:** TypeScript、Hono、Zod、Drizzle ORM、SQLite、Astro、Vitest

**Spec:** `docs/superpowers/specs/2026-09-01-session-04-boundary-storyline.md`

## Global Constraints

- Session 04は30分のままにします。
- Session 05の業務エラーとSession 06の整合性エラーを先取りしません。
- Session 04の開始状態では演習テストが失敗し、通常テストは成功する構成を維持します。
- 完成コードは演習前に全文表示せず、解答欄で初めて示します。
- ページの変更後はdocsのテストと静的ビルドを実行します。

---

### Task 1: 演習の失敗条件を事故の結果へ合わせる

**Files:**
- Modify: `examples/session-04/exercises/start-examination-input.test.ts`
- Create: `examples/session-04/exercises/clinicWebServerStub.ts`
- Modify: `examples/session-04/vitest.exercises.config.ts`
- Modify: `examples/session-04/src/web/routes.ts`
- Modify: `examples/session-04/src/web/appointmentView.ts`
- Modify: `examples/session-04/test/web/clinicFlow.test.ts`

**Interfaces:**
- Consumes: `StartExaminationInput.parse(raw: unknown)`、`createAppointmentRepository`、`registerClinicRoutes`、Drizzle schema、migration SQL
- Produces: HTTP本文の `veterinarianId` が実際に境界へ届く開始状態と、WebContainerでも動く3段階の失敗する演習テスト

- [ ] **Step 1: 入力の問題、422、副作用停止、監査データを確認する演習テストを書く**

  `better-sqlite3` を読み込まず、インメモリの `SqliteDatabase` test doubleを `createAppointmentRepository` へ渡します。Honoへ実routeを登録し、`StartExaminationInput.parse` の検証問題に `veterinarianId` のpathが残ること、不正なHTTP要求で状態と監査件数が変わらないこと、正常な要求の監査データが3項目だけになることを追加します。予約列はDrizzle schemaとmigration SQLの両方を検査します。

  WebContainerに含まれない `@fp-with-ts/clinic-web/server` だけはexercise用stubへaliasします。通常テストとproduction buildは実packageを使います。

- [ ] **Step 2: 演習テストを実行して意図した失敗を確認する**

  Run: `pnpm exercise:04`

  Expected: 正常入力の1件が成功し、入力検証、422、副作用停止、監査データ最小化の6件が失敗します。native addonやworkspace packageの解決エラーでは停止しません。

- [ ] **Step 3: 開始状態のrouteへHTTP本文を通す**

  診察開始actionから次のデータを送ります。

  ```ts
  startExamination: available(`${url}/start-examination`, {
    veterinarianId: clinicFixture.veterinarianId,
  })
  ```

  routeでは本文とpath parameterをまとめて `StartExaminationInput.parse` へ渡します。開始状態では検証と422分岐を未実装のままにし、事故を再現できる状態にします。

- [ ] **Step 4: 通常テストを実行して開始状態の事故を確認する**

  Run: `pnpm --filter @fp-with-ts/clinic-session-04 test`

  Expected: 通常操作は成功し、不正な獣医師IDが未検証で状態へ入る事故再現テストも成功します。

### Task 2: Session 05以降へ入力境界の解決を実装する

**Files:**
- Modify: `examples/session-{04,05,06,07}/src/shared/schemaResult.ts`
- Modify: `examples/session-{05,06,07}/src/web/routes.ts`
- Modify: `examples/session-{05,06,07}/src/web/appointmentView.ts`
- Modify: `examples/session-{05,06,07}/test/regression/start-examination-input.test.ts`
- Modify: `examples/session-{05,06,07}/test/web/clinicFlow.test.ts`
- Modify: `examples/session-05/test/integration/fileSqliteContinuity.test.ts`
- Modify: `examples/start-examination-continuity/test/session00To05.test.ts`
- Modify: `examples/start-examination-continuity/test/session06To07.test.ts`

**Interfaces:**
- Produces: `ValidationIssue`、`Result<T>._unsafeUnwrapErr()`、不正入力へ422を返す診察開始route

- [ ] **Step 1: Session 05の回帰テストを422と検証問題の保持へ変更する**

  不正な獣医師IDを本文から送り、レスポンスが422で、問題のpathが `veterinarianId` になり、SQLiteが変化しないことを期待します。

- [ ] **Step 2: 回帰テストを実行して500または成功応答になることを確認する**

  Run: `pnpm --filter @fp-with-ts/clinic-session-05 test`

  Expected: 422と検証問題を期待するテストが失敗します。

- [ ] **Step 3: 検証問題を保持するResultを実装する**

  ```ts
  export type ValidationIssue = Readonly<{
    path: readonly (string | number)[];
    message: string;
  }>;

  export type Result<T> = Readonly<{
    isErr: () => boolean;
    isOk: () => boolean;
    _unsafeUnwrap: () => T;
    _unsafeUnwrapErr: () => readonly ValidationIssue[];
  }>;
  ```

  `schemaResult` はZodの全issuesからpathとmessageを保存します。

- [ ] **Step 4: routeで検証結果を分岐する**

  本文を `unknown` として読み、検証失敗では次を返します。

  ```ts
  return context.json({ issues: parsed._unsafeUnwrapErr() }, 422);
  ```

  成功時だけユースケースへ進みます。

- [ ] **Step 5: Session 05から07と継続性テストへ同じ境界契約を反映する**

  正常要求には `clinicFixture.veterinarianId` を本文で送り、不正要求には `night-shift` を送ります。fixture自体は変更しません。

- [ ] **Step 6: 対象テストを実行する**

  Run: `pnpm --filter @fp-with-ts/clinic-session-05 test`

  Run: `pnpm --filter @fp-with-ts/clinic-session-06 test`

  Run: `pnpm --filter @fp-with-ts/clinic-session-07 test`

  Run: `pnpm test:continuity`

  Expected: すべて成功します。

### Task 3: Session 04本文と契約を三幕構成へ変更する

**Files:**
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Modify: `apps/docs/src/session-contracts.test.ts`
- Modify: `apps/docs/src/session-pages.test.ts`

**Interfaces:**
- Consumes: Session 05の入力境界と `ExaminationStartedAuditPayload`
- Produces: 事故、入力、HTTP停止、監査最小化を順にたどる30分のページ

- [ ] **Step 1: Session 04の契約テストを新しいメタデータへ変更する**

  タイトル、episode、時間配分、演習範囲、3つのstep、相互レビュー質問、workspaceの表示ファイルを更新します。

- [ ] **Step 2: docsテストを実行して旧ページとの不一致を確認する**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: Session 04の契約に関するテストが失敗します。

- [ ] **Step 3: ページ本文を事故調査の順番へ書き換える**

  2026-08-30のムギの診察開始事故、入力検証、422と副作用停止、監査データの最小化、隣接セッションとの分担、`Sensitive` の補足をこの順番で配置します。事故の導入では実際のHTTP要求、現在の入力変換、303応答、予約状態と監査件数の変化、個人情報を含む監査データを示します。期待した結果と実際の結果を比較し、問題を把握してから配布コードを読む順序にします。

- [ ] **Step 4: 完成コードを演習前から外す**

  事前知識では境界の契約と判断材料だけを示します。Session 05の具体的な実装は折りたたまれた解答欄で示します。

- [ ] **Step 5: docsテストを実行する**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: すべて成功します。

### Task 4: 全体検証と公開準備

**Files:**
- Verify: all modified files
- Modify: `apps/docs/e2e/session-code-playground.spec.ts`
- Modify: `examples/session-04/README.md`
- Modify: `examples/session-04/package.json`
- Modify: `package.json`

- [ ] **Step 1: 文体検査を実行する**

  長文ドキュメントとSession 04ページに対し、比喩、だ・である調、相対日付、裸の課題IDを検索し、文脈に応じて修正します。

- [ ] **Step 2: 型検査とテストを実行する**

  Run: `pnpm typecheck`

  Run: `pnpm test`

- [ ] **Step 3: docsをビルドする**

  Run: `pnpm build`

  Expected: 全sessionとdocsの静的ビルドが成功します。

- [ ] **Step 4: Session 04をモバイル幅とデスクトップ幅で確認し、ブラウザ内演習を実行する**

  `/sessions/04-boundaries-and-pii/` を開き、文章の欠落、横方向のはみ出し、章ナビゲーション、コード欄を確認します。

  Run: `pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-code-playground.spec.ts --grep "native SQLite addon"`

  Expected: WebContainer上で7件を収集し、開始状態の `1 passed / 6 failed` まで到達します。

  `0000_initial.sql` の変更前にデモを起動していた場合は、`pnpm demo:reset:04` でSession 04のローカルDBだけを作り直す手順と、予約状態・監査記録が失われる注意をREADMEとページに明記します。

- [ ] **Step 5: 差分と計画の受け入れ条件を照合する**

  `git diff --check`、`git status --short`、計画の各条件を確認します。
