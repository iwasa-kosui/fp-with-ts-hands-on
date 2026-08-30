# Issue 123 Curriculum Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 教材の抽象度をビジネスユースケース、ユースケース、ドメインロジックへ整理し、S2〜S6の演習と相互レビューを具体的な問いへ変更します。

**Architecture:** 参加者向けページを正本として用語と学習順を修正し、共有図、運営資料、契約テストを同じ変更単位で同期します。例示コードは `origin/main` の既存 snapshot から引用し、アプリケーション実装は変更しません。

**Tech Stack:** Astro、TypeScript、Vitest、Playwright、Markdown

**Spec:** `docs/superpowers/specs/2026-08-30-issue-123-curriculum-language-design.md`

## Global Constraints

- ビジネスユースケースはアクターの業務上の目的を表し、技術構成を含めません。
- ユースケースは `src/useCase` の処理と対応し、`Resolver`、ドメインロジック、`Store` を調整します。
- ドメインロジックは外部 I/O を行わない純粋な処理として説明します。
- 参加者向け資料では「業務判断」「業務ルール」「業務フロー」「業務ワークフロー」「判別共用体」「守るべき不変条件」「守る不変条件」を使いません。
- `examples/session-*` と `examples/final` は変更しません。
- 検証は docs の unit test、build、代表ページの2画面幅確認に絞ります。

---

### Task 1: S1の用語階層と永続化境界

**Files:**
- Modify: `apps/docs/src/pages/sessions/01-business-events-and-workflows.astro`
- Modify: `apps/docs/src/components/EventStormingRopComparison.astro`
- Modify: `apps/docs/src/components/StartExaminationWorkflow.astro`
- Modify: `apps/docs/src/components/RailwayOrientedProgramming.astro`
- Test: `apps/docs/e2e/session-semantic-content.spec.ts`

**Interfaces:**
- Consumes: `examples/session-01/src/useCase/startExamination.ts` の `Repository` を使う現在実装
- Produces: ビジネスユースケース、ユースケース、ドメインロジック、`Resolver`、`Store` の参加者向け定義

- [ ] **Step 1: S1の意味契約をテストへ追加する**

  `session-semantic-content.spec.ts` の S1 テストに、ページ本文が「ビジネスユースケース」「ユースケース」「ドメインロジック」を含む期待値を追加します。図の成功経路は `Resolver` と `Store` を含むことを確認します。

- [ ] **Step 2: focused testが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-semantic-content.spec.ts --grep "S1"`

  Expected: 新しい用語の期待値が未実装のため FAIL

- [ ] **Step 3: S1本文と図を修正する**

  - 「予約をキャンセルする」をビジネスユースケースとして説明します。
  - その目的をソフトウェアへ写した処理をユースケースと呼びます。
  - `Appointment.cancel` や状態遷移をドメインロジックと呼びます。
  - `Repository` が混在している現在実装から、`Resolver` と `Store` を分ける学習順を説明します。
  - 外部 I/O を分ける主な理由を、ドメインロジックを pure に保つためと明記します。
  - 図と注釈の「業務判断」「業務ルール」「業務ワークフロー」「読み込みと保存」を具体的な責任名へ変更します。

- [ ] **Step 4: focused testを再実行する**

  Run: `pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-semantic-content.spec.ts --grep "S1"`

  Expected: PASS

- [ ] **Step 5: 変更をコミットする**

  ```bash
  git add apps/docs/src/pages/sessions/01-business-events-and-workflows.astro apps/docs/src/components/EventStormingRopComparison.astro apps/docs/src/components/StartExaminationWorkflow.astro apps/docs/src/components/RailwayOrientedProgramming.astro apps/docs/e2e/session-semantic-content.spec.ts
  git commit -m "docs(session-01): ビジネスユースケースと実装責任を分ける"
  ```

### Task 2: S2〜S6の演習を具体的な問いへ変更する

**Files:**
- Modify: `apps/docs/src/pages/sessions/02-state-transitions.astro`
- Modify: `apps/docs/src/pages/sessions/03-semantic-identifiers.astro`
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Modify: `apps/docs/src/pages/sessions/05-workflow-errors.astro`
- Modify: `apps/docs/src/pages/sessions/06-effects-and-consistency.astro`
- Test: `apps/docs/src/session-pages.test.ts`

**Interfaces:**
- Consumes: 各ページの `commonReviewChecks`、`reviewCompletionArtifacts`、依頼文テンプレート、言語化手順
- Produces: セッション固有の問いと共通の検証記録

- [ ] **Step 1: セッション固有の期待値へテストを変更する**

  次の見出しをページごとの期待値にします。

  - S2: `起きてはいけない状態遷移`
  - S3: `取り違えてはいけない値`
  - S4: `境界で拒否する入力`
  - S5: `失敗後に実行してはいけない処理`
  - S6: `一緒に記録する必要がある値`

  共通成果物は `Agentへの依頼文` と `型検査では確認できず、テストまたは実行時に確認すること` に変更します。

- [ ] **Step 2: unit testが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/session-pages.test.ts`

  Expected: 旧文言が残っているため FAIL

- [ ] **Step 3: S2の用語と演習を修正する**

  - `Discriminated Union` に統一します。
  - 「受付済みでない予約から診察中へ遷移できない」を示した後で不変条件を定義します。
  - 共通レビュー文言を S2 固有の問いへ変更します。

- [ ] **Step 4: S3〜S6の演習文言を修正する**

  各ページの `commonReviewChecks`、`reviewCompletionArtifacts`、依頼文テンプレート、言語化手順を、Step 1 の固有見出しへ同期します。型検査だけで確認できない項目を、テストまたは実行時に記録させます。S4 のパース説明そのものは Task 3 で変更します。

- [ ] **Step 5: unit testを再実行する**

  Run: `pnpm --filter @fp-with-ts/docs exec vitest run src/session-pages.test.ts`

  Expected: PASS

- [ ] **Step 6: 変更をコミットする**

  ```bash
  git add apps/docs/src/pages/sessions/02-state-transitions.astro apps/docs/src/pages/sessions/03-semantic-identifiers.astro apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/src/pages/sessions/05-workflow-errors.astro apps/docs/src/pages/sessions/06-effects-and-consistency.astro apps/docs/src/session-pages.test.ts
  git commit -m "docs(sessions): 演習ごとの確認対象を具体化する"
  ```

### Task 3: S4の入力オブジェクトパースを明確にする

**Files:**
- Modify: `apps/docs/src/pages/sessions/04-boundaries-and-pii.astro`
- Test: `apps/docs/e2e/session-semantic-content.spec.ts`

**Interfaces:**
- Consumes: `AppointmentId.schema`、`VeterinarianId.schema`、`OwnerContactSchema`、`Sensitive.of`
- Produces: 小さな schema を入力オブジェクトの schema へ組み込む説明

- [ ] **Step 1: S4の表示契約をテストへ追加する**

  S4 ページが `StartExaminationInputSchema` または同等の入力オブジェクト schema、`OwnerContactSchema`、`brand`、`transform` を表示することを確認します。

- [ ] **Step 2: focused testが失敗することを確認する**

  Run: `pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-semantic-content.spec.ts --grep "S4"`

  Expected: オブジェクト全体をパースする説明の期待値で FAIL

- [ ] **Step 3: S4本文とコード説明を修正する**

  - ID と Email の schema を入力オブジェクトの部品として説明します。
  - 外部入力全体を一度パースし、成功後は型付き入力として扱うことを明記します。
  - `brand` と `transform` の説明を両方が見えるコードの直後へ置きます。
  - `brand` は取り違え防止、`transform` は `Sensitive` への変換という別の目的を説明します。

- [ ] **Step 4: focused testを再実行する**

  Run: `pnpm --filter @fp-with-ts/docs exec playwright test e2e/session-semantic-content.spec.ts --grep "S4"`

  Expected: PASS

- [ ] **Step 5: 変更をコミットする**

  ```bash
  git add apps/docs/src/pages/sessions/04-boundaries-and-pii.astro apps/docs/e2e/session-semantic-content.spec.ts
  git commit -m "docs(session-04): 入力オブジェクトのパース順を明確にする"
  ```

### Task 4: 運営資料と最小検証を同期する

**Files:**
- Modify: `docs/event/participant-setup.md`
- Modify: `docs/event/peer-review-card.md`
- Modify: `docs/event/review-sheet.md`
- Modify: `docs/event/facilitator-guide.md`
- Modify: `README.md`
- Test: `apps/docs/src/session-pages.test.ts`

**Interfaces:**
- Consumes: Task 2 のセッション固有見出し
- Produces: 参加者と TA が同じ目的を確認できるレビュー手順

- [ ] **Step 1: 参加者向けの選定目的を追加する**

  `participant-setup.md` に「TAは、同じ課題に対して設計判断が異なる差分を選びます。完成度や技能による選出ではありません。」を追加します。

- [ ] **Step 2: レビューシートとTAカードを同期する**

  - `review-sheet.md` の5欄を Task 2 の固有見出しへ変更します。
  - `peer-review-card.md` の詳細な優先順位と全員を最低1回選ぶ記録欄は維持します。
  - 共通の「不変条件」と「型で守れなかった残り」を使いません。

- [ ] **Step 3: 講師ガイドとREADMEを同期する**

  ビジネスユースケース、ユースケース、ドメインロジック、`Resolver`、`Store` を承認済みの抽象度で使います。`Discriminated Union` の表記を統一します。

- [ ] **Step 4: 廃止語を検索する**

  Run: `rg -n '業務判断|業務ルール|業務フロー|業務ワークフロー|判別共用体|守るべき不変条件|守る不変条件' apps/docs/src/pages/sessions apps/docs/src/components docs/event README.md`

  Expected: 過去文言の説明ではない参加者向け箇所に該当なし

- [ ] **Step 5: 必須のdocs検証を実行する**

  Run: `pnpm --filter @fp-with-ts/docs test`

  Expected: PASS

  Run: `pnpm --filter @fp-with-ts/docs build`

  Expected: PASS

- [ ] **Step 6: 代表画面を2幅で確認する**

  S1、S2、S4と相互レビュー部分をモバイル幅とデスクトップ幅で開き、横方向のはみ出し、コードと説明の順序、見出しの可読性を確認します。

- [ ] **Step 7: 変更をコミットする**

  ```bash
  git add docs/event/participant-setup.md docs/event/peer-review-card.md docs/event/review-sheet.md docs/event/facilitator-guide.md README.md apps/docs/src/session-pages.test.ts
  git commit -m "docs(event): 相互レビューの選定目的と記録項目を揃える"
  ```
