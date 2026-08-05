# Workers PR プレビュー URL コメント Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR プレビュー Worker のデプロイ成功後、最新 URL を固定コメントとして PR に投稿する。

**Architecture:** deploy step が Wrangler の出力から Workers URL を取得して `GITHUB_OUTPUT` に渡す。後続の `actions/github-script` step がマーカー付きの bot コメントを検索し、存在すれば更新、なければ作成する。コメント書込み権限は deploy job に限定する。

**Tech Stack:** GitHub Actions, Wrangler 4.x, actions/github-script@v7, Node.js, pnpm

## Global Constraints

- URL は Wrangler の標準出力から取得し、Cloudflare アカウントのサブドメインを設定値として重複管理しない。
- URL が取得できなければ job を失敗させ、空または推測した URL をコメントしない。
- 固定コメントの識別子は `<!-- workers-pr-preview -->` とし、GitHub Actions bot が投稿したコメントだけを更新する。
- `issues: write` は deploy job にだけ付与し、cleanup job は既存の `contents: read` 権限を維持する。
- コメントは同一リポジトリ PR のデプロイ成功後だけで実行する。外部フォークと `closed` では実行しない。
- `.github/workflows/deploy.yml`、Worker 名、cleanup の削除コマンドは変更しない。

---

## File Structure

- Modify: `.github/workflows/preview.yml` — デプロイ URL の出力、最小権限、固定コメントの作成・更新を担う。
- Create: `docs/superpowers/plans/2026-08-05-workers-pr-preview-comment.md` — この実装計画。アプリケーションコードは変更しない。

### Task 1: URL を含む固定 PR コメント

**Files:**
- Modify: `.github/workflows/preview.yml`
- Test: 一時的な Node.js のインライン検証コマンド（リポジトリへテストコードは追加しない）

**Interfaces:**
- Consumes: Wrangler deploy の標準出力、`GITHUB_OUTPUT`、`${{ github.event.pull_request.number }}`、GitHub Actions の `GITHUB_TOKEN`。
- Produces: `steps.deploy.outputs.preview_url` と、`<!-- workers-pr-preview -->` を含む PR の bot コメント。

- [ ] **Step 1: URL コメント要件を表す失敗する検証を書く**

次のコマンドを実行する。現在の workflow には job 固有の `issues: write`、URL 出力、GitHub Script の固定コメントがないため、`Missing deploy comment permissions` で失敗することを確認する。

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/preview.yml", "utf8");
const requirements = [
  ["deploy comment permissions", /deploy:\n    permissions:\n      contents: read\n      issues: write/],
  ["URL output", /id: deploy[\s\S]*preview_url=\$preview_url/],
  ["failure-safe deploy capture", /set -o pipefail[\s\S]*tee "\$RUNNER_TEMP\/wrangler-deploy\.log"/],
  ["URL extraction", /https:\/\/\[\^\[:space:\]\]\+\\\.workers\\\.dev/],
  ["sticky comment action", /uses: actions\/github-script@v7/],
  ["sticky comment marker", /<!-- workers-pr-preview -->/],
  ["comment update", /github\.rest\.issues\.updateComment/],
  ["comment creation", /github\.rest\.issues\.createComment/],
];

for (const [label, pattern] of requirements) {
  if (!pattern.test(workflow)) throw new Error(`Missing ${label}`);
}
'
```

- [ ] **Step 2: 失敗理由を確認する**

コマンドの終了コードが 0 以外で、最初の失敗が `Missing deploy comment permissions` であることを確認する。既存のプレビュー作成・削除設定を誤って壊したことではなく、未実装のコメント機能だけが失敗理由であることを確認する。

- [ ] **Step 3: deploy job に URL 出力と固定コメントを追加する**

`.github/workflows/preview.yml` の deploy job へ `permissions` を追加し、Deploy step を次の内容に置き換える。

```yaml
  deploy:
    permissions:
      contents: read
      issues: write
    if: >-
      github.event.action != 'closed' &&
      github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
```

```yaml
      - name: Deploy preview Worker
        id: deploy
        run: |
          set -o pipefail
          pnpm exec wrangler deploy --name "$PREVIEW_WORKER_NAME" 2>&1 | tee "$RUNNER_TEMP/wrangler-deploy.log"

          preview_url=$(sed -nE 's#.*(https://[^[:space:]]+\.workers\.dev).*#\1#p' "$RUNNER_TEMP/wrangler-deploy.log" | tail -n 1)
          if [ -z "$preview_url" ]; then
            echo "Workers preview URL was not found in Wrangler output." >&2
            exit 1
          fi

          echo "preview_url=$preview_url" >> "$GITHUB_OUTPUT"

      - name: Comment preview URL
        uses: actions/github-script@v7
        env:
          PREVIEW_URL: ${{ steps.deploy.outputs.preview_url }}
        with:
          script: |
            const marker = "<!-- workers-pr-preview -->";
            const body = `${marker}\n\n🚀 [プレビュー環境を開く](${process.env.PREVIEW_URL})`;
            const { owner, repo } = context.repo;
            const issue_number = context.issue.number;
            const comments = await github.paginate(
              github.rest.issues.listComments,
              { owner, repo, issue_number, per_page: 100 },
            );
            const existingComment = comments.find(
              (comment) =>
                comment.user?.login === "github-actions[bot]" &&
                comment.body?.includes(marker),
            );

            if (existingComment) {
              await github.rest.issues.updateComment({
                owner,
                repo,
                comment_id: existingComment.id,
                body,
              });
            } else {
              await github.rest.issues.createComment({
                owner,
                repo,
                issue_number,
                body,
              });
            }
```

`permissions` は job レベルで上書きされるため、Checkout に必要な `contents: read` も明示する。cleanup job は変更しない。

- [ ] **Step 4: 要件検証と品質ゲートを通す**

Step 1 の Node.js 検証を再実行し、終了コード 0 で全要件を満たすことを確認する。次に workflow 構文、既存の品質ゲート、Worker bundle を確認する。

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/preview.yml"); puts "YAML syntax OK"'
pnpm typecheck
pnpm test
pnpm build
WRANGLER_WRITE_LOGS=false pnpm exec wrangler deploy --dry-run --name "fp-with-ts-hands-on-pr-999999"
```

GitHub API へのコメント作成・更新は、同一リポジトリの PR を更新して GitHub Actions が成功したこと、かつ固定コメントが URL で作成・更新されたことを確認する。

- [ ] **Step 5: workflow をコミットする**

worktree を明示して差分を確認し、workflow だけをコミットする。

```bash
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci diff --check
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci add .github/workflows/preview.yml
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci commit -m "ci(workers): comment preview URL"
```

### Task 2: 既存 draft PR を更新する

**Files:**
- Modify: GitHub draft PR #16 の head branch と本文
- Test: `gh pr view 16 --json url,title,isDraft,state,headRefName`

**Interfaces:**
- Consumes: `workers-preview-ci` branch、PR #16、Task 1 のコミット。
- Produces: origin に push 済みのブランチと、URL コメントの設計を含む更新済み draft PR 本文。

- [ ] **Step 1: branch を push する**

```bash
git -C /Users/kosui/ghq/github.com/iwasa-kosui/fp-with-ts-hands-on/.wt/workers-preview-ci push
```

- [ ] **Step 2: PR 本文を更新する**

`/private/tmp/workers-pr-preview-body.md` を次の内容にし、`gh pr edit` へ渡す。

```markdown
## 背景

Workers で配信しているドキュメントサイトは、変更をマージするまで実環境で確認できない。レビュー段階で、各 PR の変更を独立した URL で確認できるようにする。

## 内容

PR ごとに独立した Worker をライフサイクルに合わせて管理し、更新を安定したプレビュー環境へ反映する。デプロイ結果を固定コメントで案内し、クローズ時には環境ごと削除する。外部フォークにはデプロイ権限を渡さない。

## Test Plan

- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `WRANGLER_WRITE_LOGS=false pnpm exec wrangler deploy --dry-run --name "fp-with-ts-hands-on-pr-999999"`

---
Generated with Codex
```

```bash
gh pr edit 16 --title "ci(workers): add PR preview deployments" --body-file /private/tmp/workers-pr-preview-body.md
```

- [ ] **Step 3: PR 更新を確認する**

```bash
gh pr view 16 --json url,title,isDraft,state,headRefName
```

期待値は URL が `https://github.com/iwasa-kosui/fp-with-ts-hands-on/pull/16`、title が `ci(workers): add PR preview deployments`、`isDraft` が `true`、`state` が `OPEN`、`headRefName` が `workers-preview-ci` であること。

## Plan Self-Review

- **Spec coverage:** Task 1 は URL 取得、URL 未取得時の失敗、固定コメントの作成・更新、job 限定の書込み権限、同一リポジトリのみの実行条件、既存 cleanup の維持、ローカルと GitHub Actions の検証を扱う。Task 2 は既存 draft PR への反映を扱う。
- **記述の完全性:** 作業対象、識別子、コマンド、検証条件をすべて明示している。
- **Consistency:** `preview_url`、`workers-pr-preview`、`workers-preview-ci`、PR #16 は URL 出力、固定コメント、push、PR 更新で一貫して同じ値を使う。
