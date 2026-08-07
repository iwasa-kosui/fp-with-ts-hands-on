# Product-independent AGENTS.md Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最終成果物として、リポジトリ全体と `apps/docs/` の責務に分けた、製品非依存の2つの `AGENTS.md` を整備する。

**Architecture:** ルートファイルを教材全体の判断基準とし、`apps/docs/` の子ファイルは公開サイト固有の追加条件だけを持つ。ルートと子の継承関係を保ち、同じ規則を重複させない。

**Tech Stack:** Markdown、pnpm 9.12.0、Node.js 20以上、Git

製品非依存の制約と次の Global Constraints は、最終成果物である2つの `AGENTS.md` だけを対象とし、この計画書の実行手順と必須 sub-skill の表記は対象外とする。

## Global Constraints

- 判断基準は `docs/prd/prd-001.md` とする。
- 特定のエージェント製品、モデル、ツール名、個人環境の絶対パスを成果物へ書かない。
- 特定のPR番号、コミットID、一時的なブランチ名やworktreeパスを書かない。
- `packages/clinic-example/src/legacy/` の意図的な問題を、通常の改善対象として扱わない。
- 現在のworked exampleでは `exercise:00` は意図的に失敗し、`exercise:01` から `exercise:05` は成功する。
- 子ファイルへ、ルートのディレクトリ説明、worktree手順、TypeScript方針を重複させない。

---

### Task 1: ルートのリポジトリ指示

**Files:**
- Create: `AGENTS.md`
- Reference: `docs/superpowers/specs/2026-08-06-agents-guidance-design.md`
- Reference: `docs/prd/prd-001.md`
- Reference: `package.json`

**Interfaces:**
- Consumes: PRD、現行ディレクトリ構成、ルートpackage scripts
- Produces: リポジトリ全体へ適用する目的、構成、不変条件、作業フロー、TypeScript方針、検証契約

- [ ] **Step 1: ファイル契約が未実装であることを確認する**

Run:

```bash
test -f AGENTS.md
```

Expected: FAIL。ルートに `AGENTS.md` がまだ存在しない。

- [ ] **Step 2: ルート `AGENTS.md` を作成する**

次の見出しと内容を日本語で記載する。

```markdown
# リポジトリ作業ガイド

## 目的と判断基準
## リポジトリ構成
## 教材の不変条件
## 作業フロー
## TypeScriptの設計方針
## 検証
```

内容は次を満たす。

- 目的を「関数型ドメインモデリングを、型の技巧ではなく業務事故の防止として体験できる教材」と定義する。
- 教材変更前に `docs/prd/prd-001.md` の対象参加者、前提知識、期待する行動変容を確認する。
- `apps/docs/`、`legacy/`、`clinic/`、通常テスト、演習テスト、`worker/`、`docs/event/`、`docs/design/` の責務を列挙する。
- 業務上の要求または事故から始め、不変条件、技法、限界、検証、振り返りを対応させる。
- 参加者が編集する範囲を原則2関数以内に保つ。
- `legacy` を先回りして直さず、worked example、演習、説明を同期する。
- 計画依頼と実装依頼を区別し、現在の依頼で承認された仕様・計画だけを拘束条件として扱う。
- 提供済みworktreeを優先し、新規作成が必要な場合だけ指定ブランチまたは最新の `origin/main` を基点にする。
- `Readonly`、判別共用体、純粋な状態遷移、Zod、Branded Type、`Result`、`Sensitive`、`.js` suffixを現在の教材方針として記載する。
- `ExaminationStarted` は現在の診察開始ユースケースで成功時だけ記録する契約に限定する。
- 通常の検証、全体検証、演習コマンドの期待結果、未実施検証の報告方法を明記する。

- [ ] **Step 3: ルートファイルの構造と製品非依存性を検証する**

Run:

```bash
rg -n '^## (目的と判断基準|リポジトリ構成|教材の不変条件|作業フロー|TypeScriptの設計方針|検証)$' AGENTS.md
rg -n 'Claude|Codex|Opus|Sonnet|/Users/|~/|PR #[0-9]+|#[0-9]+' AGENTS.md
git diff --check
```

Expected: 最初の `rg` は6見出しを返す。禁止対象を探す2番目の `rg` は何も返さず終了コード1。`git diff --check` は終了コード0。

- [ ] **Step 4: ルートファイルをコミットする**

```bash
git add AGENTS.md
git commit -m "docs: リポジトリ全体の作業ガイドを追加"
```

### Task 2: `apps/docs/` 固有の公開サイト指示

**Files:**
- Create: `apps/docs/AGENTS.md`
- Reference: `apps/docs/src/modules/catalog.ts`
- Reference: `apps/docs/scripts/verify-static-build.mjs`
- Reference: `apps/docs/package.json`
- Reference: `worker/routes.ts`

**Interfaces:**
- Consumes: Task 1のルート指示と公開サイトの現行構造
- Produces: モジュールページ、トップページ、同期対象、視覚検証、docs固有検証の追加条件

- [ ] **Step 1: 子ファイル契約が未実装であることを確認する**

Run:

```bash
test -f apps/docs/AGENTS.md
```

Expected: FAIL。`apps/docs/AGENTS.md` がまだ存在しない。

- [ ] **Step 2: `apps/docs/AGENTS.md` を作成する**

次の見出しと内容を日本語で記載する。

```markdown
# 公開サイト作業ガイド

## モジュールページの受け入れ条件
## トップページの保護
## 変更時に同期する対象
## 視覚検証
## 変更範囲別の検証
```

内容は次を満たす。

- `src/pages/modules/*.astro` に限り、背景、登場人物の要求、出来事、参加者の作業、確認方法、期待する気づきをページ単体で理解できる構造にする。
- 最初のモジュールだけでなく、後続モジュールも同じ学習構造を保つ。
- 状態モデリングでは、業務イベント、遷移前、遷移後、実装する関数を対応させる。
- 時系列や状態遷移を理解しづらい表だけで説明せず、内容に応じてタイムライン、段階表示、状態図、カードを使う。
- すべての参加者向けページでは、日本の開発現場で自然な日本語を使い、不自然な直訳やプロジェクトで定着していない用語を避ける。ただし、トップ、案内、エラーページにモジュール構造を強制しない。
- 明示的な依頼がない限り、トップページの見た目、文章、情報量、主要導線を変えない。
- モジュール変更時に `catalog.ts`、Astroページ、ページテスト、静的ビルドの必須HTML、内部リンク、必要なWorkerルートを同期する。
- 現行の `test:visual` はトップページだけを対象とすることを明記する。
- モジュールUI変更では、対象URLをモバイル幅とデスクトップ幅で確認するか、視覚テストへ対象を追加する。
- ページ、CSS、Workerルーティングごとの具体的なpnpmコマンドを書く。

- [ ] **Step 3: 子ファイルの構造と責務分担を検証する**

Run:

```bash
rg -n '^## (モジュールページの受け入れ条件|トップページの保護|変更時に同期する対象|視覚検証|変更範囲別の検証)$' apps/docs/AGENTS.md
rg -n 'Claude|Codex|Opus|Sonnet|/Users/|~/|Readonly|Branded Type|worktree|packages/clinic-example' apps/docs/AGENTS.md
git diff --check
```

Expected: 最初の `rg` は5見出しを返す。禁止対象またはルートとの重複を探す2番目の `rg` は何も返さず終了コード1。`git diff --check` は終了コード0。

- [ ] **Step 4: 子ファイルをコミットする**

```bash
git add apps/docs/AGENTS.md
git commit -m "docs: 公開サイト固有の作業ガイドを追加"
```

### Task 3: 横断検証

**Files:**
- Verify: `AGENTS.md`
- Verify: `apps/docs/AGENTS.md`
- Reference: `docs/superpowers/specs/2026-08-06-agents-guidance-design.md`

**Interfaces:**
- Consumes: Task 1とTask 2の成果物
- Produces: 設計に対する検証結果とcleanなworktree

- [ ] **Step 1: 参照パスとスクリプトを検証する**

Run:

```bash
git ls-files --error-unmatch docs/prd/prd-001.md apps/docs/src/modules/catalog.ts apps/docs/scripts/verify-static-build.mjs worker/routes.ts package.json apps/docs/package.json
pnpm --filter @fp-with-ts/docs run
```

Expected: 6ファイルが列挙され、`test`、`build`、`typecheck`、`test:visual` が表示される。

- [ ] **Step 2: 禁止対象と重複を横断検証する**

Run:

```bash
rg -n 'Claude|Codex|Opus|Sonnet|/Users/|~/|PR #[0-9]+|#[0-9]+' AGENTS.md apps/docs/AGENTS.md
rg -n 'Readonly|Branded Type|worktree|packages/clinic-example' apps/docs/AGENTS.md
git diff --check
```

Expected: 2つの `rg` は何も返さず終了コード1。`git diff --check` は終了コード0。

- [ ] **Step 3: 基準テストと最終状態を確認する**

Run:

```bash
pnpm test
git status --short --branch
git log -4 --oneline
```

Expected: docs 26件、clinic-example 11件の合計37件が成功する。作業ツリーに未コミット差分がない。直近4コミットが設計、実装計画、ルート指示、docs指示の4コミットである。
