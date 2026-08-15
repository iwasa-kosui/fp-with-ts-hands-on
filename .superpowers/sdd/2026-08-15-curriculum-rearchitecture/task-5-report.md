# Task 5 実装レポート

## 実装概要

- 開始 HEAD: `fb2f014`
- 対象: 教材サイトの 6 セッション再構築、Code Explorer の catalog 駆動化、旧 URL の移行、静的サイト契約の更新
- 公開セッション: `00-onboarding`、`01-state-modeling`、`02-boundary-and-ids`、`03-result-errors`、`04-effects-and-events`、`final`
- playground: Session 1〜4 の 4 箇所だけ
- 静的 HTML: `index.html`、`404.html`、6 セッションの計 8 ファイルだけ
- 非公開 snapshot: session05 は Code Explorer の推移確認用に維持し、公開 route にはしない

## catalog と教材構造

Task 4 で承認された session catalog をページ、目次、演習、workspace の唯一のメタデータ源とした。各 exercise ページは `steps`、`decisions`、`finalReferences`、`peerReview` を map し、step 数を固定値で仮定しない。

| Session | step 数 | 編集予算（関数 / 行） |
| --- | ---: | ---: |
| Session 1 | 4 | 2 / 35 |
| Session 2 | 2 | 2 / 24 |
| Session 3 | 3 | 3 / 77 |
| Session 4 | 4 | 3 / 35 |

- Session 0 は 5 つの約束事を全文表示し、各章へ anchor で移動できるようにした。
- Session 1 は約束事を全文表示し、Session 2 以降は Session 1 の約束事へリンクする。
- Final は playground を持たず、5 分の講師ツアーと開始前・4 セッション後・最終形の 3 差分を読む構成にした。
- desktop/mobile の目次は同じ catalog chapter 定義を参照し、各章を直接リンクする。

## Code Explorer

- `project-files`、`session-workspaces`、`code-guides`、`SessionCodeOverview` を全 slug に一般化した。
- 各 slug に 2〜3 個を目安とする code guide を用意し、participant に見せるファイルは starter だけに限定した。
- 全 snapshot の `ProjectFiles` に論理パス `../fixtures/clinic.ts` を含めた。
- Session 4 exercise と非公開 session05 snapshot について、TypeScript の相対 import が fixture を含め推移的に閉じることをテストした。example 側の import は変更せず、mock で隠していない。
- `../` は一般許可せず、`../fixtures/*` だけを external fixture として受け付ける。その他の path traversal は拒否する。

### WebContainer の最終構成

WebContainer の runtime root を次の兄弟ディレクトリに分離した。

```text
runtime root
├── fixtures/clinic.ts
└── workspace/
    ├── package.json
    ├── src/...
    └── exercises/...
```

- internal tree は、先に `workspace` を作成してから `mountPoint: "workspace"` へ mount する。
- external fixture は runtime root の `fixtures/clinic.ts` へ別途 write する。
- install、Vitest、participant の write はすべて `workspace` を cwd/root として扱う。
- これにより source 内の論理 import `../fixtures/clinic.ts` を書き換えずに解決する。

### 実ブラウザ診断で棄却した仮説

1. internal tree と `../fixtures` を同じ fake mount tree へ入れる案は、Vite が実際の親ディレクトリに module を見つけられず失敗した。
2. fixture を `/home/fixtures` の絶対位置へ置く案は、WebContainer の file system が workdir 配下にスコープされるため解決しなかった。

さらに、存在しない nested mount point を直接指定すると `[FS] invalid mount point` になったため、`workspace` を明示的に作成してから mount する最小修正を加えた。

## isolation header の診断と controller decision

brief では、route 固有の Code Explorer 設定が見つからないため `astro.config.ts` は no-op と判断していた。しかし実 Chromium では `crossOriginIsolated === false`、Node fetch でも COEP/COOP が応答に存在しなかった。Astro 4 は `vite.server/preview` ではなく top-level `server.headers` を読むことを、設定契約テストと実レスポンスで確認した。

controller の承認により、Task 5 の実行基盤バグとして `server: { headers: isolationHeaders }` へ移し、効かない `vite.server/preview` block を削除した。修正後の実応答は次を返し、実 Chromium でも `crossOriginIsolated === true` になった。

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

## Worker と移行契約

以下の 4 path を `/sessions/04-effects-and-events/` へ 308 redirect する。

- `/sessions/04-agent-review`
- `/sessions/04-agent-review/`
- `/sessions/05-mini-integration`
- `/sessions/05-mini-integration/`

route object だけでなく HTTP response の status/location と、redirect 時に asset binding が呼ばれないことをテストした。

## TDD 記録

### RED

- route inventory: 旧 Session 4/5 が残り、catalog の 6 route と一致しない構造 assertion。
- session structure/exercise: chapter、約束事、可変 step、decision、final reference、peer review の不足による 11 assertion failure。
- Code Explorer: slug ごとの workspace/guide、starter 可視性、fixture closure の不足による assertion failure。
- runner: `../fixtures` を fake internal mount として扱う契約違反の assertion failure。
- overview/code guide: onboarding 固定と guide 不足による assertion failure。
- Worker: 旧 4 path が asset に委譲され 200 になる HTTP/asset-call assertion failure。
- isolation header: top-level `server.headers` がなく、実応答と契約 assertion が失敗。
- 実ブラウザ: `crossOriginIsolated === false`、続いて fixture の module resolution failure、absolute `/home/fixtures` failure、nested mount failure を順に観測した。

意図した単体 RED は import/module error ではなく、業務・構造・HTTP 契約の assertion failure で観測した。module resolution error は実 WebContainer の結合診断でだけ発生し、上記の runtime root 分離で解消した。

### GREEN

- page/catalog 構造: 19/19
- runner/workspace/code guide: 最終 targeted 23/23、最終説明文修正後の workspace/playground 11/11
- isolation header + Worker: 21/21
- docs 全体: 21 files、117/117
- Worker focused: 20/20
- static build: 0 errors、0 warnings、0 hints、8 HTML / 8 allowed internal routes
- visual/E2E: 28/28

## 実ブラウザ smoke

- dev server: `0.0.0.0:4321`
- mobile preview URL: `http://nordvpn-kilimanjaro2484.nord:4321/`
- Chromium の対象 URL: `http://127.0.0.1:4321/sessions/04-effects-and-events/`
- viewport: mobile `390x844`、desktop `1440x1200`
- `crossOriginIsolated`: `true`
- 選択ファイル: `exercises/effects-and-events.test.ts`
- package install: 49 packages、18 秒
- Vitest cwd: runtime の `workspace`
- 結果: exit 1。教材で意図した次の 4 AssertionError を確認した。
  - fixed clock/id
  - `store(event)` once
  - `aggregateState` through pipeline
  - `RepositoryError` / atomicity
- `module-not-found`、`ERR_MODULE_NOT_FOUND`、fixture load failure は発生しなかった。

## visual inspection

Session 0、1、4、Final を mobile/desktop の計 8 画像で目視した。目次、Session 0 の table/dl、code guide、可変 step と decision、playground、Final の 3 差分はいずれも clipping、重なり、水平 overflow なし。home の visual snapshot は既存画像と一致した。

## 最終検証

- `pnpm --filter @fp-with-ts/docs test`: 117/117
- `pnpm --filter @fp-with-ts/docs build`: Astro check 0 diagnostics、8 HTML、8 allowed routes
- Worker focused tests: 20/20
- `pnpm typecheck`: 成功
- `pnpm test`: 成功（docs 117/117 を含む）
- `pnpm build`: 成功（8 HTML）
- `pnpm --filter @fp-with-ts/docs test:visual`: 28/28
- 最終説明文修正後の targeted: 11/11
- 最終説明文修正後の docs test/build: 117/117、0 diagnostics、8 HTML
- `git diff --check`: 成功

## 削除・保護範囲

削除したもの:

- 公開旧 route `04-agent-review`、`05-mini-integration`
- standalone `/code-explorer` route、専用 CSS、header block、旧テスト
- Task 4 の legacy alias、layout/workspace shim
- onboarding 固定 guide と古いページ固定テスト

変更していないもの:

- `examples/**`
- root `package.json` / lockfile
- PRD（Task 4 で更新済みの正規 PRD に従い、追加変更は不要と判断）
- `docs/event/**`
- home page / home CSS / home E2E / screenshot

既知の監査事項として home index の「1〜2関数」という既存表現は今回の禁止範囲にあるため変更していない。

## NEEDS_CONTEXT

なし。brief の Astro no-op 判断は controller の明示承認を得て、実行基盤バグの最小修正へ更新した。
