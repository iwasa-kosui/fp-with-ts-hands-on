# `examples/final` Operator Console UI 再設計

## 目的

`examples/final` の業務機能と認可境界を変えずに、フロントエンドを高密度な業務 SaaS の見た目へ統一します。主利用環境である動物病院のデスクトップ PC では、現在の予約状況と次に行う操作を短時間で把握できることを優先します。タブレットでも安全に操作でき、狭い画面で情報や操作が欠落しない構成にします。

今回の変更は視覚と情報設計が対象です。Hono の route、Inertia props、use case、認証・認可、ドメイン状態、SQLite 永続化形式は変更しません。

## 採用する方向

Superdesign で現状再現と次の二案を比較し、利用者が案 1 を選択しました。

1. **Operator Console（採用）**: 232px の常設サイドバー、コンパクトなトップバー、密度の高い作業キュー、補助的なオペレーションパネル
2. Focused Workspace（不採用）: 折りたたみレールと検索中心のトップバー、余白を広く取ったモジュール型ワークスペース

採用案:

- [Superdesign preview](https://p.superdesign.dev/draft/5d21af79-1aa4-4148-88da-c856a953979d)
- [Superdesign canvas](https://superdesign.dev/teams/fe77d982-bc65-4513-9258-9a52234aff23/projects/e026f708-1604-466c-9c7c-f442000c1f6e?live=1)

## 設計原則

- 見た目は落ち着いた B2B SaaS とし、ペット向け消費者アプリの可愛らしさへ寄せません。
- 予約、診察、会計、フォローアップという業務の進行状態を、装飾ではなく情報階層と意味色で伝えます。
- 既存の server-projected action flags を唯一の操作可否情報として扱います。UI 側で認可や状態遷移を再判定しません。
- 既存の Inertia props にない業務データ、検索機能、通知、件数、臨床情報を作りません。
- PII と診療自由記述の公開範囲を広げません。既存のページ DTO だけを表示します。
- ネイティブ要素の意味を維持し、ボタンに見える `div`、表に見える汎用グリッド、ラベルのない入力欄は作りません。

## デザイントークン

### 色

| 用途 | 値 |
| --- | --- |
| アプリ背景 | `#F4F7FB` |
| 基本サーフェス | `#FFFFFF` |
| 補助サーフェス | `#F8FAFC` |
| 選択サーフェス | `#EEF2FF` |
| 標準ボーダー | `#E2E8F0` |
| 強調ボーダー | `#CBD5E1` |
| 本文 | `#0F172A` |
| 補助本文 | `#64748B` |
| プライマリ | `#4F46E5` |
| 成功 | `#0F766E` |
| 注意 | `#B45309` |
| 危険 | `#B91C1C` |
| 情報 | `#0369A1` |

プライマリ色は現在地、主要操作、リンク、フォーカスリングだけに使います。成功、注意、危険、情報の各色には淡色背景を対で用意し、状態名を必ずテキストでも表示します。グラデーション、ネオン、ガラス表現、装飾目的の意味色は使いません。

### 文字、間隔、形状

- フォント: `Inter, "Noto Sans JP", ui-sans-serif, system-ui, sans-serif`
- ページタイトル: 24px / 32px / 700
- セクションタイトル: 16px / 24px / 650
- 本文: 14px / 21px / 400–500
- 表とメタデータ: 13px / 20px
- ラベル: 12px / 16px / 600
- 間隔: 4、8、12、16、20、24、32px
- 入力と通常ボタン: 40px、コンパクト操作: 36px
- 角丸: 入力 8px、カード 10px、主要パネル 12px
- カードは 1px border で区切り、常設カードへ重い影を付けません。

## アプリケーションシェル

### デスクトップ

認証後の全画面は同じ `AppShell` を使います。

- 左に 232px の常設サイドバーを置きます。
- 上部に診療所マークとアプリ名、中央に役割別ナビゲーション、下部にログイン利用者とログアウト操作を置きます。
- ナビゲーションは既存 route と既存 role の範囲だけを表示します。現在地は淡い indigo 背景、左アクセント、アイコン、ラベルで示します。
- 絵文字は使わず、線幅と表示サイズを揃えたインライン SVG アイコンを使います。
- メイン側上部にコンパクトなトップバーを置き、現在ページの文脈とユーザー役割を確認できるようにします。未実装の検索や通知は追加しません。
- ページ本文は最大 1440px、左右 24–32px のガターで表示します。

### 未認証画面

`Setup` と `Login` にはサイドバーを表示しません。アプリ背景上の中央カードにブランド、目的の短い説明、フォームをまとめます。初期設定とログインを視覚的に区別しつつ、入力、エラー、ボタンの部品は認証後画面と共有します。

## 共通コンポーネント

`examples/final/src/adaptor/primary/web/components/` に、表示責務だけを持つ小さな部品を置きます。

- `AppShell`: role-aware navigation、トップバー、ユーザー領域、本文領域
- `PageHeader`: eyebrow または説明、`h1`、主操作
- `Card`: header/body/footer を持つ境界付きサーフェス
- `Button` / `ButtonLink`: primary、secondary、ghost、danger。処理中と disabled を共有
- `StatusBadge`: 状態値から意味色と日本語ラベルを表示。色だけへ依存しない
- `DataTable`: ネイティブ `table` を包み、モバイル時の横スクロールだけを担当
- `FormField`: label、control、description、既存 `FieldError` の関係を揃える
- `EmptyState`: 説明と、存在する場合だけ一つの関連操作
- `InlineAlert`: `notice`、validation、danger の意味と `role` を保持
- `Icon`: allowlist されたインライン SVG だけを描画

これらは Hono route、Inertia form、domain/use case を import しません。ページが既存 props を部品へ明示的に渡します。

## 画面別の構成

### ダッシュボード

- ページヘッダーに `ダッシュボード` と、権限がある場合だけ `新しい予約` を置きます。
- 飼い主、ペット、予約、進行中予約の四件をコンパクトなメトリクスカードとして一行に配置します。
- 予約一覧を主領域とし、ペット名、予約時刻、状態、詳細操作を密な行で表示します。
- 補助領域には既存 props から導出できる状態内訳または既存 route へのショートカットだけを置きます。
- 件数がない場合は大きな空白を残さず、短い EmptyState を表示します。

### 予約一覧・新規登録

- 一覧は状態バッジを持つ DataTable とし、行全体の視認性を上げます。詳細遷移は明示的なリンクで残します。
- 新規登録は最大幅 720px のフォームカードへまとめます。関連する項目を短いセクションに分け、ページ末尾まで視線を往復させません。
- validation summary と field error の既存 ARIA 関係を維持します。

### 予約詳細

- デスクトップは 2 カラムとします。左に対象と状態、時系列メタデータ、右に現在実行可能な一つの操作カードを置きます。
- 状態名は日本語を主表示とし、必要な箇所だけ canonical state を補助表示します。
- `canCheckIn`、`canStartExamination`、`canRecordExamResult`、`canPay`、`canCancel` など既存 action flag が許すフォームだけを描画します。
- 診察結果登録後の `AwaitingPayment` は注意色の状態として表示し、会計操作を右側の焦点カードにします。
- 過去の診療自由記述を、既存 DTO が提供しない場所へ再表示しません。

### 飼い主・ペット・ユーザー管理

- 一覧は共通 DataTable、ページ右上に主要な追加操作を置きます。
- 編集と削除は行末にまとめ、削除だけ danger 表現にします。
- 監査履歴保持と完全消去ではない旨の既存説明は、一覧上部の InlineAlert として維持します。
- 作成・編集は共通フォーム幅と項目間隔を使います。ユーザー編集のプロフィールとパスワード再設定は別カードに分けます。
- role、ownerId、petId などの既存表示内容や server-side 制約は変えません。

### フォローアップ

- 選択可能な対象を checkbox 付き DataTable で表示します。
- 選択数と `フォローアップを依頼` を表の下の固定的な action bar にまとめます。
- 依頼済み行はテキストと status badge で判別し、checkbox の disabled だけへ依存しません。
- 対象がない場合は一件の EmptyState を表示します。

### イベント履歴

- 管理者向け監査一覧として密な DataTable を使い、時刻、actor、aggregate、event を列で比較できるようにします。
- サニタイズ済み scalar DTO だけを表示し、raw event payload を展開する UI は追加しません。
- PII の非表示と物理削除後も履歴が残る既存説明を InlineAlert で示します。

## レスポンシブ設計

- `>= 1100px`: 232px サイドバー、最大幅コンテンツ、予約詳細などは 2 カラム
- `768–1099px`: サイドバーをコンパクトなアイコンレールへ縮小し、ラベルは accessible name とツールチップで補います。詳細の操作カードは本文下へ積みます。
- `< 768px`: ナビゲーションはヘッダーから開くドロワー相当へ切り替えます。フォームとカードは一列、表は意味を維持した横スクロールとします。
- 横スクロールは表のコンテナ内に限定し、ページ全体に発生させません。
- hover だけで操作や説明を公開しません。

## 状態とインタラクション

- hover、focus、サイドバー展開は 120–180ms に揃え、`prefers-reduced-motion` では抑制します。
- `:focus-visible` に 2px の indigo ring と offset を表示します。
- form processing 中はラベルを `…中` に変え、二重送信を防ぐ既存 `disabled` を維持します。
- destructive action の既存確認ダイアログと説明文は維持します。
- validation error はページ上部の summary と入力直下の field error の双方で表示し、`aria-describedby` と `aria-invalid` を維持します。

## 実装方針

- CSS framework やコンポーネントライブラリは追加せず、既存 React と CSS で構築します。
- `styles.css` をデザイントークン、reset/base、layout、components、page-specific、responsive の順に整理します。
- CSS custom properties を唯一の色・寸法ソースとし、ページ側の inline style は使いません。
- ページ固有の JSX を共通部品へ寄せますが、汎用化のための複雑な polymorphic component は作りません。
- 既存 route URL、form method、field name、Inertia props、ページ component 名は維持します。
- 表示ラベルの改善は可能ですが、状態や業務ルールの意味を変えません。

## 検証

### 自動検証

- 既存 route integration tests で認証、認可、validation、redirect、状態遷移が変わらないことを確認します。
- React SSR page tests を更新し、全ページが新しい shell と共通部品を通して描画できることを確認します。
- action flag ごとの予約詳細表示、`AwaitingPayment` の会計操作、role ごとのナビゲーション、error summary と ARIA の回帰テストを残します。
- ビルドで client、SSR、built app artifact が生成できることを確認します。
- package と root の `typecheck`、`test`、`build` を実行します。

### 手動検証

- 1440px で sidebar、metrics、table、予約詳細の 2 カラムを確認します。
- 1024px でナビゲーション縮小とカードの積み替えを確認します。
- 768px 未満でページ全体の横 overflow がなく、表だけをスクロールできることを確認します。
- keyboard だけで主要 navigation、form、table action、logout を辿ります。
- Setup、Login、各 role の Dashboard、一覧、フォーム、予約 lifecycle、FollowUp、Events を実データで目視します。

## 非ゴール

- 新しい検索、通知、グラフ、ダークモード
- route、use case、domain event、SQLite schema の変更
- 認証・認可判断のフロントエンド移植
- raw audit payload や、既存 DTO にない PII・診療自由記述の表示
- UI component library、CSS framework、外部 icon package の導入
- consumer 向けペットポータル、アニメーション中心の表現

## 受け入れ条件

1. 認証後の全ページが同じ Operator Console shell とデザイントークンを使う。
2. Setup と Login を含む全フォームが共通の入力、ボタン、エラー表現を使う。
3. 一覧画面が共通 DataTable、状態バッジ、空状態、主要操作の階層を共有する。
4. 予約詳細が現在の状態と唯一の有効操作を明確に分離し、`AwaitingPayment` で会計操作を提示する。
5. role-aware navigation と server-projected action flags の既存契約を維持する。
6. 1440px と 1024px で主要業務が効率よく使え、768px 未満でも情報や操作が欠落しない。
7. PII、診療自由記述、監査 payload の既存境界を広げない。
8. package/root の typecheck、test、build が成功する。
