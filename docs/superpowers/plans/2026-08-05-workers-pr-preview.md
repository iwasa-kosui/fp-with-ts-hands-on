# Workers PR プレビュー環境 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一リポジトリの Pull Request ごとに Cloudflare Workers のプレビュー Worker を作成・更新し、クローズ時に削除する GitHub Actions CI を追加する。

**Architecture:** 新しい `pull_request` ワークフローが PR 番号を Worker 名と concurrency group の識別子に使う。オープン・再オープン・更新時は既存の品質ゲートを通してから PR 専用 Worker をデプロイし、クローズ時（マージを含む）は同名の Worker を強制削除する。本番向けの `deploy.yml` は変更しない。

**Tech Stack:** GitHub Actions, pnpm 9.12.0, Node.js 24, Wrangler 4.x, Cloudflare Workers

## Global Constraints

- 対象は `github.event.pull_request.head.repo.full_name == github.repository` を満たす同一リポジトリの PR のみとし、外部フォークに `CLOUDFLARE_API_TOKEN` を渡さない。
- プレビュー Worker 名は `fp-with-ts-hands-on-pr-${{ github.event.pull_request.number }}` とする。
- GitHub Actions の権限は `contents: read` のみ、Cloudflare の認証は既存の `CLOUDFLARE_API_TOKEN` secret のみを使う。
- 更新前には `pnpm typecheck`、`pnpm test`、`pnpm build` をこの順で実行する。
- 同じ PR 番号の古い実行を `cancel-in-progress: true` でキャンセルする。
- 本番 Worker `fp-with-ts-hands-on` と `.github/workflows/deploy.yml` を変更しない。

---

## File Structure

- Create: `.github/workflows/preview.yml` — PR のプレビュー Worker をデプロイ・削除する唯一のワークフロー。
- Create: `docs/superpowers/plans/2026-08-05-workers-pr-preview.md` — この実装計画。アプリケーションコード、Wrangler 設定、本番デプロイワークフローは変更しない。

### Task 1: PR プレビュー Worker ワークフロー

**Files:**
- Create: `.github/workflows/preview.yml`
- Test: 一時的な Node.js のインライン検証コマンド（リポジトリへテストコードは追加しない）

**Interfaces:**
- Consumes: `CLOUDFLARE_API_TOKEN` GitHub Actions secret、root の `pnpm typecheck`・`pnpm test`・`pnpm build` scripts、`wrangler.jsonc` の Worker エントリポイントと static assets 設定。
- Produces: PR 番号 `N` に対する Worker `fp-with-ts-hands-on-pr-N`。PR のオープン・再オープン・更新ではその Worker の現行バージョン、クローズではその Worker を削除する。

- [ ] **Step 1: プレビューのライフサイクル要件を表す失敗する検証を書く**

次のコマンドを実行する。まだ `preview.yml` がないため、`ENOENT` で失敗することを確認する。

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/preview.yml", "utf8");
const requirements = [
  ["PR lifecycle trigger", /pull_request:/],
  ["PR events", /opened[\s\S]*reopened[\s\S]*synchronize[\s\S]*closed/],
  ["per-PR concurrency", /group: workers-pr-preview-\$\{\{ github\.event\.pull_request\.number \}\}/],
  ["same-repository guard", /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/],
  ["preview deploy", /wrangler deploy --name "\$PREVIEW_WORKER_NAME"/],
  ["preview cleanup", /wrangler delete "\$PREVIEW_WORKER_NAME" --force/],
];

for (const [label, pattern] of requirements) {
  if (!pattern.test(workflow)) throw new Error(`Missing ${label}`);
}
'
```

- [ ] **Step 2: 失敗が意図どおりであることを確認する**

上のコマンドの終了コードが 0 以外で、`ENOENT: no such file or directory` が `.github/workflows/preview.yml` を指していることを確認する。パターンの不一致や Node.js の構文エラーではなく、未実装のワークフローだけが失敗理由であることを確認する。

- [ ] **Step 3: 最小の PR プレビュー workflow を追加する**

`.github/workflows/preview.yml` を次の内容で作成する。

```yaml
name: Preview

on:
  pull_request:
    types:
      - opened
      - reopened
      - synchronize
      - closed

concurrency:
  group: workers-pr-preview-${{ github.event.pull_request.number }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  PREVIEW_WORKER_NAME: fp-with-ts-hands-on-pr-${{ github.event.pull_request.number }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

jobs:
  deploy:
    if: >-
      github.event.action != 'closed' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Deploy preview Worker
        run: pnpm exec wrangler deploy --name "$PREVIEW_WORKER_NAME"

  cleanup:
    if: >-
      github.event.action == 'closed' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Delete preview Worker
        run: pnpm exec wrangler delete "$PREVIEW_WORKER_NAME" --force
```

`env` を workflow スコープに置くことで、両ジョブが同じ PR 番号から同じ Worker 名を得る。`closed` はマージ済みと未マージのクローズの両方で発生するため、cleanup job の条件に `merged` 判定を追加しない。

- [ ] **Step 4: 検証を通す**

Step 1 の Node.js 検証を再実行し、終了コード 0 で全要件を満たすことを確認する。続けて YAML 構文と既存の品質ゲートを確認する。

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/preview.yml"); puts "YAML syntax OK"'
pnpm typecheck
pnpm test
pnpm build
pnpm exec wrangler deploy --dry-run --name "fp-with-ts-hands-on-pr-999999"
```

Wrangler の dry-run はアップロードしない。アカウント認証を要する実デプロイとクローズ後の削除は、同一リポジトリの PR で GitHub Actions を実行して確認する。

- [ ] **Step 5: CI 設定をコミットする**

worktree を明示して差分を確認し、workflow だけをコミットする。

```bash
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci diff --check
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci add .github/workflows/preview.yml
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci commit -m "ci: add Workers PR previews"
```

## Plan Self-Review

- **Spec coverage:** Task 1 covers same-repository restriction, the four required PR events, quality gates before deploy, PR-specific Worker naming, per-PR concurrency, `--force` cleanup on `closed`, unchanged production deployment, and token/permission use.
- **記述の完全性:** すべての作業対象、コマンド、検証条件を明示している。
- **Consistency:** `PREVIEW_WORKER_NAME`、`workers-pr-preview` concurrency group、`CLOUDFLARE_API_TOKEN` はすべてワークフローと検証コマンドで同じ名前を使う。
