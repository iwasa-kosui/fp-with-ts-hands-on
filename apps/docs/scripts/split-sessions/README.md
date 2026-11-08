# Session をページに分割する手順

## 最初に書くファイル（Session ごとに新規）

これらのファイルは Session ごとに分かれているので、並行の作業で衝突しません。`<slug>` は Session の slug（例は `03-boundaries-and-pii`）です。

- `apps/docs/src/sessions/pages/<slug>.ts`: `sessionSlug` と `sessionPages` を export します。`apps/docs/src/sessions/pages/split-sessions.fixture.ts` が glob でこのファイルを読みます。
- `apps/docs/scripts/split-sessions/<slug>.mjs`: 期待値を default export します。参考は同じディレクトリの `03-boundaries-and-pii.mjs` です。`index.mjs` とテストはこのディレクトリのファイルを自動で集めるので、一覧を編集する必要はありません。項目の意味は次のとおりです。
  - `previous`、`previousTitle`、`next`、`nextTitle`: 前後の Session の href とタイトルです。S00 の前と Final の次は省略します。
  - `expectedPages`: `[slug, title, flow, kind, minutes]` の並びです。slug が空文字のページは Session の最初のページです。`kind` が `advanced` のページは時間外なので、`minutes` を 0 にします。
  - `pages`: `expectedPages` の slug から導きます。参考ファイルは `expectedPages.map(([slug]) => slug)` と書いています。
  - `lastInTime`: 時間内の最後のページの slug です。
- `apps/docs/src/pages/sessions/<slug>/[page].astro`: `apps/docs/src/pages/sessions/03-boundaries-and-pii/[page].astro` を写し、ページ定義の import と `import.meta.glob` の Session 名を書き換えます。`import.meta.glob` はリテラルしか受け付けないので、各 Session にこの1行が残ります。
- `apps/docs/src/sessions/prose/<slug>/<page>.mdx`: ページごとに1ファイルを置きます。slug が空文字のページは `index.mdx` です。
- 最初のページ `apps/docs/src/pages/sessions/<slug>.astro`: `03-boundaries-and-pii.astro` を参考に書きます。参考ファイルは `03-boundaries-and-pii-content.ts` から値を読みます。
  - `session` は必ず export します。`apps/docs/src/pages/sessions/index.astro` が一覧の表示に `session` を読むためです。
  - `guides` は、`snapshot` を持つ Session で必須です。
  - `workspace` の slug は `session.slug` と同じ値にします。`guardExerciseWorkspaceFor` の戻り値を `workspace` として export しません。戻り値の slug は `guard-exercise:<slug>` という別の値で、保存を `CodeExplorer` と分けるために使います。

## 演習を持つ Session で追加する作業

- `examples/<snapshot>/exercises/guard/` と `examples/<snapshot>/eslint.config.mjs` を置きます。`exercises/guard/` にファイルが無いと、`guardExerciseWorkspaceFor` が例外を投げて build が失敗します。`exercises/guard/guard.config.mjs` を置くと、`apps/docs/src/code-explorer/project-files.ts` が `vendor/exercise-guard` と `guard` スクリプトを snapshot に加えます。参考は `examples/session-03-solution/exercises/guard/` です。
- `examples/<snapshot>/` に、`package.json`、`tsconfig.json`、`vitest.config.ts` も置きます。
- `apps/docs/src/code-explorer/guard-paths.ts` の前提にそろえます。
  - 相互レビューのファイル名は `exercises/guard/cases/R1-peer-change.ts` に固定です。
  - 解答は `exercises/guard/answer/mine/` に置きます。
  - 解答から subjects と src へは、`../../subjects/` と `../../../../src/` の相対パスで書きます。`answerDisplaySource` がこの2つの文字列を、表示用のパスに置き換えます。
- `apps/docs/src/sessions/pages/<slug>-exercise.ts` に `guardExercise = { slug, snapshot }` を置きます。MDX から `guardExerciseWorkspaceFor(guardExercise, projectFiles, 説明)` を呼びます。参考は `apps/docs/src/sessions/pages/03-boundaries-and-pii-exercise.ts` と、`apps/docs/src/sessions/prose/03-boundaries-and-pii/exercise.mdx` です。
- `apps/docs/scripts/build-deps-snapshot.mjs` は、`examples/*-solution/exercises/guard` を持つ snapshot を自動で集めます。このファイルを編集する必要はありません。

## 編集が要る共通のファイル

並行の PR で衝突しうるファイルです。自分の Session の行だけを変更します。

- 新しい snapshot 名を足すとき:
  - `apps/docs/src/sessions/types.ts` の `ExampleSnapshot`
  - `apps/docs/src/code-explorer/project-files.ts` の `snapshots`
  - `apps/docs/src/code-explorer/project-files.test.ts` の `allSnapshots`
  - `*-solution` に `exercises/guard` を足すときは、同じテストの `terminalPackageJsonSources` の glob と、件数の検査 `toHaveLength` も直します。
- 前後の Session の `.astro` が持つ `previous` と `next` の href。URL が変わるときだけ直します。
- Session ごとの文言や章を検査するテスト:
  - `apps/docs/src/session-contracts.test.ts` の `expectedCurriculum`、`expectedEpisodes`、`expectedExercises`、`expectedNavigation`
  - `apps/docs/src/session-pages.test.ts` の Session 別の定義
- 旧 URL を保つとき: `worker/routes.ts`、`worker/routes.test.ts`、`scripts/verify-urls.mjs`。
- `*-solution` を足すとき:
  - `scripts/baseline-check.mjs`
  - `scripts/verify-exercises.mjs`
  - ルートの `package.json` の `verify:guard`。現在は `--root examples/session-03-solution` だけを検査します。

## 共通にしないもの

- 図の形とアニメーションの仕組みは、題材ごとに決めます。`apps/docs/src/components/stepper/` は、題材に合うときだけ使います。
