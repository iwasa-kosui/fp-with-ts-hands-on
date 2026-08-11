# ハンズオン教材ゼロベース再設計

## 背景

2026-08-30 15:00-18:00（180分、connpass、オフライン開催、5人1班＋各班 TA 1名）のイベントに向けて、`examples/` と `apps/docs` をゼロベースで設計し直す。残り19日。

現行教材（`examples/session-00`〜`session-05` の6スナップショットと `apps/docs` の7ページ）には、調査で確認した次の構造的な問題がある。

- **演習量が制約を破っている。** `AGENTS.md` と PRD-06 が定める「参加者が編集する範囲は原則2関数以内」に対し、実際の演習は白紙からのファイル新規作成で、生成すべきコードは exercise:01 が 114 行、exercise:02 が 8 ファイル 114 行、exercise:03 が 8 ファイル新規＋7 ファイル改修の 185 行に達する。25〜30分では完走しない。
- **演習形式が4種類に割れている。** 事故デモ（00）、白紙からの新規作成（01/02/03/05）、TODO 穴埋め（04）が混在し、04 は 20分枠に対して実質5分で終わる。
- **演習が完了不能なものがある。** `examples/session-02/package.json` の依存は `vitest` のみだが exercise:02 は Zod を要求する。`examples/session-03/package.json` は `zod` のみだが exercise:03 は neverthrow の `isOk()` を要求する（実ファイルで確認済み）。
- **セッション間の連鎖に断絶がある。** session-03 → 04 で `safeParse` → `parse` の破壊的変更が7ファイル分「隠れ改修」として入っている。session-04 の演習は 04 → 05 の実差分（dual-write 解消、Timestamp branding、port 分割）を一切カバーしていない。session-05 演習の `collectFollowUpTargets` は `examples/final` にシグネチャが存在せず、解答の参照先がない。
- **番号がずれている。** `examples/session-01/README.md` は「Session 01 で実装する型付き状態モデル」と書き、`examples/session-02/README.md` は同じ主題を「Session 02: 型で状態遷移を閉じる」と名乗る。
- **`exercises/**` が typecheck 対象外。** 全セッションの `tsconfig.json` の include は `["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]`。型で教える教材で、参加者が最も読むファイルの型が検証されていない。
- **`examples/final` との距離が埋まらない。** session-05 と final は src+test 行数で28倍、未紹介の概念が15種以上ある。`durationMinutes: 10` の「完成例を眺める」枠では橋渡しにならない。

本設計は、これらを「180分・最大2関数・穴埋めとリファクタリングのみ」という制約の下でゼロから組み直す。

## 目的

- 180分で参加者が到達する地点を、`examples/final` と明確に区別して定義する。
- 全セッションの演習を「配布された素朴なコードのリファクタリング」と「穴埋め」の2形式に統一し、編集対象を最大2関数に収める。
- セッション間の連鎖（N の完成形が N+1 の出発点）を、人手の同期ではなくテストで機械的に担保する。
- `apps/docs` のセッションページを catalog 駆動の共通骨格へ移し、文言 literal 一致に依存したテストを構造検証へ置き換える。
- 調査で判明した既知の欠陥を、実装フェーズのどの段階で直すかを確定する。

## 対象外

- **`examples/final` は変更しない。** 到達点ではなく参照実装＋お土産として扱い、当日は読む／見せるだけにする。参加者は final の環境構築をしない。
- 白紙からのファイル新規作成を求める演習は採らない。
- 過去に却下済みの方針は蒸し返さない: サーバー側での参加者コード実行、編集内容の永続化・共有 URL・localStorage、Safari / Firefox の正式対応、Markdown parser の導入、Git tag による章管理、セッション間で共有する内部 package、外部 CDN 依存の Shiki。
- Astro Content Collections / MDX / 外部 CMS は導入しない（理由は「6. `apps/docs` の再構成」に記す）。
- event sourcing、projection、永続イベントストア、認証・認可、HTTP アダプタの詳細設計は当日の手を動かす範囲から外す（PRD 非ゴール）。
- 通常の再診フロー、`examples/final` の UI 方針（Operator Console）には触れない。

---

## 1. 到達点の再定義

### 1.1 当日の到達点（`examples/session-05` スナップショット）

180分後に参加者の手元にあるのは、**単一集約（予約）を、型で守られた同期パイプラインとして表現した約 400 行の TypeScript プロジェクト**である。具体的には次を満たす。

- 予約は5状態の判別共用体で表され、状態ごとに必須項目が違う。`Paid` / `Canceled` から戻る遷移関数は存在しない。
- 外部入力（検査ラボ JSON、飼い主連絡先）は Zod schema と smart constructor を通してのみドメイン型になる。ID は用途別 branded type で、取り違えがコンパイルエラーになる。
- 個人情報は `Sensitive<T>` に包まれ、`JSON.stringify` / `console.log` / `util.inspect` のいずれでも `[REDACTED]` になる。
- 予期可能な失敗は `throw` ではなく `Result<T, E>` の tagged union で返り、呼び出し側が `kind` で網羅的に分岐できる。
- 時刻と ID は port として注入され、ドメイン関数は決定的である。状態と監査記録は1つの `store(event)` で同時に保存され、片方だけ残ることがない。

**これは `examples/final` ではない。** final は7集約・30ユースケース・Hono/Inertia/React/Drizzle/SQLite を含む 23,000 行超のアプリケーションであり、180分で到達できる規模ではない。final は「学んだ型が実アプリでどう使われるか」を示す参照実装として、当日は講師デモ10分で見せ、帰宅後の自習材とする。

### 1.2 31概念の取捨

`examples/final` から抽出した31概念を、「演習で手を動かす」「配布コード中で読む」「お土産（final を読む／自習）」の3つに割り振る。

| # | 概念 | 扱い | 配置 | 理由 |
|---|---|---|---|---|
| 1 | 不変性と `Readonly` / `as const` | 演習（暗黙） | 全セッション | 配布コードが全て `Readonly`。独立した解説枠は取らず S1 冒頭で2分 |
| 2 | `as const satisfies T` | 演習 | S1 | 遷移関数の戻り値組み立てで必須。`as` を追放する主要イディオム |
| 3 | コンパイラ設定の前提 | 読む | S0 | `tsconfig.base.json` を1分見せる。設定を書かせる時間はない |
| 4 | 純粋関数とカリー化 / 部分適用 | 演習 | S4 | `(context) => (state) => Event` と `(deps) => (input) => Result` の両方が S4 で必要になる |
| 5 | タグ付き共用体で状態を表す | 演習 | S1 | 全体の土台。ここが崩れると以降が成立しない |
| 6 | 網羅性検査と `assertNever` | 読む | S1 | 配布コードの `toStatusLabel` に含める。演習対象にすると3関数目になる |
| 7 | 不正な状態を表現不能にする遷移関数 | 演習 | S1 | S1 の主演習そのもの |
| 8 | Branded / Nominal type | 演習 | S2 | ID 取り違え事故の直接の解 |
| 9 | Smart constructor | 演習 | S2 | branded type と一体。`schema` + `parse` のコンパニオン |
| 10 | Parse, don't validate | 演習 | S2 | S2 の設計思想。境界を1箇所に決める |
| 11 | `Sensitive<T>` | 演習 | S2 | PII ログ事故の直接の解。実装は配布、使う側を書かせる |
| 12 | `Result<T, E>` と tagged union のエラー | 演習 | S3 | S3 の主題 |
| 13 | `Result` を返す絞り込み関数 | 演習 | S3 | S3 の穴埋め対象 |
| 14 | `map` / `andThen` / `mapErr` による合成 | 演習 | S3 | S3 のリファクタ対象 |
| 15 | `ResultAsync` と `andThrough` | **お土産** | final | 非同期の合成は同期 `Result` を理解してからでよい。180分では同期に絞る |
| 16 | `reduce` + `andThen` による traverse | **お土産** | final | 現行 session-05 が15分でこれを課して破綻した。最も削るべき箇所 |
| 17 | エラー型の合成と写像 | **お土産** | final | 単一ユースケースでは必要性が出ない |
| 18 | 例外を `Result` に閉じ込める | **お土産** | final | 教材側は最初から例外を投げない設計なので動機が薄い |
| 19 | 1メソッド port | 演習 | S4 | S4 の主題の半分 |
| 20 | 非決定性の注入（Clock / IdGenerator） | 演習 | S4 | 「テストが日によって落ちる」事故の解 |
| 21 | 関数による DI と合成ルート | 読む | S4 | 配布する `main.ts` を読む。書かせると2関数を超える |
| 22 | capability を型で要求する | **お土産** | final | 認可の概念自体が当日の範囲外 |
| 23 | Read model / DTO の分離 | **お土産** | final | UI 層がない教材では動機が出ない |
| 24 | 型付きドメインイベント | 演習（最小版） | S4 | 6型引数の汎用 `DomainEvent` は使わず、5フィールドの具体イベント1種に絞る |
| 25 | 状態と監査を同時に保存する | 演習（概念） | S4 | in-memory store で dual-write 解消だけを体験。transaction は扱わない |
| 26 | 楽観的並行制御と型付き conflict | **お土産** | final | DB が要る。参加者環境に DB を置かない制約と衝突 |
| 27 | DB が最終判定する不変条件 | **お土産** | final | 同上 |
| 28 | 読み取り境界での再検証と sanitize | **お土産** | final | 同上 |
| 29 | 複数集約をまたぐドメインサービス | **お土産** | final | 現行 session-05 の演習。180分では単一集約に絞る |
| 30 | union を保つ型レベル変換 | **お土産** | final | 初級〜中級には難度が高すぎる |
| 31 | フェイク port によるユースケーステスト | 読む | S3 / S4 | 配布テストコードとして読む。書かせる時間はない |

集計: **演習16、読む4、お土産11**（合計31）。

### 1.3 お土産の届け方

お土産11項目は「final を眺めろ」では届かない。`/sessions/final/` に **「今日の到達点から final までの4つの差分」** という節を新設し、次の順で読む道筋を示す。

| 差分 | 何が変わるか | 最初に読むファイル |
|---|---|---|
| 1. 同期 → 非同期 | `Result` → `ResultAsync`、`andThrough` で副作用を通す | `examples/final/src/useCase/startExaminationUseCase.ts` |
| 2. 1集約 → 7集約 | 集約が増えたときの port とエラー union の広げ方 | `examples/final/src/useCase/errors.ts` |
| 3. in-memory → SQLite | 状態と監査を1 transaction に、conflict を型で返す | `examples/final/src/adaptor/secondary/sqlite/store/appointmentEventStore.ts` |
| 4. 単体 → 全域検証 | 全件検証の traverse、読み取り境界の再検証 | `examples/final/src/domain/followUp/collectFollowUpTargets.ts` |

---

## 2. セッション構成案

### 2.1 全体タイムテーブル（合計180分）

| 経過 | 時刻 | 枠 | 内容 | 分 |
|---|---|---|---|---:|
| 0:00-0:10 | 15:00-15:10 | 固定 | オープニング、班分け、環境確認（`pnpm test` が緑であること） | 10 |
| 0:10-0:30 | 15:10-15:30 | S0 | 引き継ぎ: 先人のコードと2件の事故報告を読む | 20 |
| 0:30-1:00 | 15:30-16:00 | S1 | 状態を型にする | 30 |
| 1:00-1:30 | 16:00-16:30 | S2 | 値を型にする（境界・ID・PII） | 30 |
| 1:30-1:40 | 16:30-16:40 | 固定 | 休憩 | 10 |
| 1:40-2:10 | 16:40-17:10 | S3 | 失敗を値にする | 30 |
| 2:10-2:40 | 17:10-17:40 | S4 | 副作用を外に出す | 30 |
| 2:40-2:50 | 17:40-17:50 | Final | 参照実装ツアー（講師デモ） | 10 |
| 2:50-3:00 | 17:50-18:00 | 固定 | まとめ、行動計画、質疑 | 10 |

**検算**: 固定枠 10 + 10 + 10 = **30分**。セッション 20 + 30 + 30 + 30 + 30 + 10 = **150分**。合計 **180分**。

うち参加者が手を動かす演習時間は 12 + 12 + 13 + 12 = **49分**（全体の27%）。

### 2.2 現行 6回 30/30/25/30/20/15 から変えた理由

| 変更 | 理由 |
|---|---|
| セッション本編を 6 → 5（うち演習ありは4） | 演習を最大2関数に収めると、1演習は「RED を読む→2関数を書く→GREEN→なぜそう書くか」で最低25分かかる。6本×平均25分＝150分では固定枠30分と合わせて180分を超える。演習ありを4本に絞り、1本あたり30分の完全な学習ループを保証する |
| Session 00 を 30 → 20分 | 現行 session-00 と session-01 の src 差分は実質1行（`diff` で確認）で、同じスナップショットに60分を割いている。業務理解＋コード読解は20分で足り、浮いた40分を演習へ回す |
| 「エージェントレビューを設計する」を独立セッションとして廃止 | 現行 exercise:04 は 24 行の定数配列と文字列連結で、答えの大半が `exercises/agent-review.test.ts:7-16` に逐語で書かれている（`"save(state, events)"`, `"nodejs.util.inspect.custom"`）。FP の演習でも「穴埋め＋リファクタ」形式でもない。PRD が求める「AI に依頼する前提のレビュー観点」は各セッションの `#review` 章に1〜2行ずつ分散し、まとめ10分で「今日の型は AI にコードを書かせるときのガードレールになる」として回収する |
| 「ミニ総合演習」を独立セッションとして廃止 | 15分で「既習5技法の統合＋未知のイベント設計＋`Result` の畳み込み」は不可能で、現行ガイド自身が「押したら講師の worked example に切り替え」と完走を前提していない。さらに解答が final に存在しない。統合の体験は S4（副作用を外に出す）が S1〜S3 の成果物の上に積み上がることで代替する |
| 休憩を90分地点（16:30）に1回 | 現行は70分地点。S1・S2 が連続する前半90分と、S3・S4 が連続する後半80分に分かれ、中央で切れる |
| `final` を10分の講師デモとして正式にタイムテーブルへ入れる | 現行は catalog に `durationMinutes: 10` があるのにタイムテーブルに枠がなく、合計190分になっていた（未決事項）。参加者は環境構築をせず、講師が画面で見せる |

### 2.3 セッション一覧

| # | slug | テーマ | kind | 分 | 演習 | 編集する関数 |
|---|---|---|---|---:|---|---:|
| 00 | `00-onboarding` | 引き継ぎ: 退職した先人のコードと2件の事故報告 | orientation | 20 | なし | 0 |
| 01 | `01-state-modeling` | 状態を型にする | exercise | 30 | 穴埋め＋リファクタ | 2 |
| 02 | `02-boundary-and-ids` | 値を型にする（境界・ID・PII） | exercise | 30 | 穴埋め＋リファクタ | 2 |
| 03 | `03-result-errors` | 失敗を値にする | exercise | 30 | 穴埋め＋リファクタ | 2 |
| 04 | `04-effects-and-events` | 副作用を外に出す | exercise | 30 | リファクタ＋穴埋め | 2 |
| — | `final` | 参照実装ツアー | reference | 10 | なし | 0 |

slug は `00`〜`03` を現行から据え置く（テーマがほぼ一致し、リダイレクトが不要）。`04-agent-review` と `05-mini-integration` は廃止し、`04-effects-and-events` を新設する。旧2 URL は worker で `/sessions/04-effects-and-events/` へリダイレクトする。

---

## 3. 各セッションの設計

各セッションは共通の5章骨格を持つ（詳細は「6.2 セッションページの骨格」）。以下、章ごとの中身を定義する。

### 3.0 Session 00 — 引き継ぎ（20分・演習なし）

**要求**: 先人の獣医が診療の合間にバイブコーディングで作ったシステムを、新任エンジニアのあなたが引き継ぐ。

**事故（事故報告として読む。テストは実行しない）**:

1. **二重請求**: 会計済み（`paid`）の来院が、`updateStatus(id, "in-examination")` で診察中へ戻され、会計が二度走った。
2. **PII 流出**: `logger.info("appointment booked", appointment)` が飼い主の氏名・メール・電話番号を含む予約オブジェクトをそのまま JSON 化してログに残していた。

> 事故を再現する赤いテストは、**それを直す回の冒頭で走らせる**。Session 00 では事故報告（業務側の記述）とコードの対応だけを見る。2026-08-08 の「Session 00 で赤いテストを見せない」判断はこの形で維持する。

**配布する「ひどいコード」**: `examples/session-00/src/legacy/appointment.ts`（現行 `examples/session-00/src/appointment.ts` を移設）。素朴さの中身は次の5点。

| # | 素朴な書き方 | なぜ事故るか |
|---|---|---|
| 1 | `status: string` | 業務で使う状態の種類も、許可される遷移も型から読めない |
| 2 | `LegacyStatusExtra` の optional 6項目 | どの状態で何が必須かが型に表れない。`cancelReason` なしでキャンセルできる |
| 3 | ID が全部 `string` | `petId` を渡すべき所へ `ownerId` を渡してもコンパイルが通る |
| 4 | `throw new Error(...)` | 呼び出し側が扱うべき失敗の種類が関数の型から判断できない |
| 5 | `logger.info(msg, appointment)` | ログに出してよい情報の境界が値にも型にも表れない |

**受講者がリファクタする対象**: **なし（0関数）**。読むだけ。

**到達する型/パターン**: なし（`tsconfig.base.json` の `strict` / `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` を1分で確認するのみ）。

**時間内訳**: 業務とアプリケーションの説明 8分 / ガイド付き Code Explorer で5箇所を各自確認 8分 / 班内で「一番怖いのはどれか」を共有 4分 = **20分**。

---

### 3.1 Session 01 — 状態を型にする（30分）

**要求**: 会計済み・キャンセル済みの来院を、あとから診察中へ戻せないようにしたい。キャンセルには必ず理由を残したい。

**事故**: 事故報告 #1（二重請求）。`pnpm exercise:01` が赤で始まる。

**配布する「ひどいコード」**: `examples/session-01/src/domain/appointment.ts`。5状態の判別共用体（`Scheduled` / `CheckedIn` / `InExamination` / `Paid` / `Canceled`）と `assertNever` を使った `toStatusLabel` は**配布済み**。遷移関数だけが素朴に書かれている。

```ts
// 配布される素朴版（動くが守られていない）
export const startExamination = (
  appointment: Appointment,
  veterinarianId: string,
): Appointment => {
  if (appointment.kind === "Paid") throw new Error("cannot start");
  return {
    ...appointment,
    kind: "InExamination",
    veterinarianId,
    examinationStartedAt: new Date().toISOString(),
  } as Appointment; // ← as で押し通している
};
```

なぜ事故るか: 遷移の可否を**実行時の `if` 1本**でしか守っておらず、`Canceled` からの遷移は素通りする。戻り値を `as Appointment` でキャストしているため、必須項目が欠けていてもコンパイルが通る。呼び出し側は型から「どの状態から呼べるか」を知れない。

**受講者がリファクタする対象（最大2関数 — 本セッションはちょうど2関数）**:

| # | 関数 | 形式 | 作業 |
|---|---|---|---|
| 1 | `startExamination` | リファクタ | 第1引数の型を `Appointment` → `CheckedIn` に絞り、`as Appointment` を `as const satisfies InExamination` に置き換える |
| 2 | `cancel` | 穴埋め | 第1引数を `Scheduled \| CheckedIn` に絞り、`CancellationReason` を必須引数にして `Canceled` を組み立てる（本体が `// TODO` の1行） |

union 型の定義そのものは配布する。型を書かせると編集量が2関数を大きく超え、12分では終わらない。「型を書く」ではなく「配布された型に関数を合わせる」ことで、型が制約として働く体験を先に得る。

**到達する型/パターン**: 判別共用体、遷移元を引数型で縛る純粋関数、`as const satisfies`、逆行遷移の関数を作らない設計。網羅性検査（`assertNever`）は配布コード中で読む。

**`examples/final` の対応ファイル**: `src/domain/appointment/appointment.ts`、`src/domain/shared/assertNever.ts`。

**GREEN の判定**: `pnpm exercise:01` が緑になる。加えて `test/state-modeling.test.ts` の `// @ts-expect-error` 節が「`Paid` を `startExamination` に渡すとコンパイルエラー」を型レベルで固定する。

**時間内訳**: 事故報告の再確認＋RED 実行 5分 / 判別共用体と `as const satisfies` の解説 7分 / 演習 12分 / GREEN・解答解説・振り返り 6分 = **30分**。

---

### 3.2 Session 02 — 値を型にする（30分）

**要求**: 外部の検査ラボから届く JSON をカルテに取り込みたい。フォロー電話のために飼い主の連絡先を扱いたい。

**事故**:

1. **他人のカルテに検査結果が付いた**: ラボの JSON の識別子を `petId` として受け取る箇所へ `ownerId` を渡していた。全部 `string` なのでコンパイルは通っていた。
2. **PII 流出**（事故報告 #2）: `logger.info` に渡した値に電話番号とメールが平文で含まれていた。

**配布する「ひどいコード」**: 2ファイル。

```ts
// examples/session-02/src/boundary/examResult.ts（配布される素朴版）
export const parseExamResult = (raw: any): ExamResult => ({
  examId: raw.examId,
  petId: raw.petId,
  items: raw.items ?? [],
  needsFollowUp: !!raw.needsFollowUp,
});
```

```ts
// examples/session-02/src/boundary/ownerContact.ts（配布される素朴版）
export const parseOwnerContact = (raw: any): OwnerContact => ({
  ownerId: raw.ownerId,
  name: raw.name,
  email: raw.email,   // 素の string のまま
  phone: raw.phone,   // 素の string のまま
});
```

なぜ事故るか: `any` を通しているので外部 JSON の形が変わっても気づかない。ID が `string` なので取り違えを型が止められない。連絡先が素の `string` なので `JSON.stringify` すればどこにでも漏れる。

**受講者がリファクタする対象（ちょうど2関数）**:

| # | 対象 | 形式 | 作業 |
|---|---|---|---|
| 1 | `parseExamResult` | リファクタ | `raw: any` → `raw: unknown`。`ExamResultSchema` を組み（`ExamId.schema` / `PetId.schema` を使う）、`schemaResult(ExamResultSchema)` を返す |
| 2 | `parseOwnerContact` | 穴埋め | `email` / `phone` の schema に `.brand<...>().transform(Sensitive.of)` を足し、`schemaResult` を通す |

`Sensitive` 本体（`src/shared/sensitive.ts`）、`schemaResult`（`src/shared/schemaResult.ts`）、branded ID（`src/domain/*Id.ts`）は**配布済み**。演習は「用意された部品を境界に配置する」ことに絞る。

**到達する型/パターン**: Zod `.brand<...>()` による nominal typing、`schema` + `parse` のコンパニオンオブジェクト（smart constructor）、Standard Schema → `Result` のブリッジ、`Sensitive<T>`、parse don't validate。

**`examples/final` の対応ファイル**: `src/domain/shared/schemaResult.ts`、`src/domain/shared/sensitive.ts`、`src/domain/appointment/appointmentId.ts`、`src/domain/owner/ownerPhone.ts`、`src/domain/examResult/examResult.ts`。

**GREEN の判定**: `pnpm exercise:02` が緑。判定条件は3つ — (a) 不正な JSON が `err` になる、(b) `ownerId` を `petId` の位置に渡すとコンパイルエラー（`@ts-expect-error` で固定）、(c) `JSON.stringify(contact)` と `console.log` 相当の出力に電話番号が現れず `[REDACTED]` になる。

**時間内訳**: 事故報告＋RED 5分 / branded type・smart constructor・`Sensitive` の解説 8分 / 演習 12分 / GREEN・解説・振り返り 5分 = **30分**。

> 密度に関する判断ポイント: 本セッションは3技法を扱い、5本の中で最も詰まっている。実装フェーズのリハーサルで12分に収まらない場合、`parseOwnerContact` を穴埋めから「1行の `.transform(Sensitive.of)` を足すだけ」へさらに縮める。それでも溢れる場合、`Sensitive` を解説のみに降格し、演習2関数目を `parseExamResult` の items 検証へ差し替える。

---

### 3.3 Session 03 — 失敗を値にする（30分）

**要求**: 診察開始に失敗したとき、画面に理由を出したい。

**事故**: 予約が見つからないときに投げていた例外のメッセージ文言を変えたところ、UI が 404 ではなく 500 を返すようになり、受付が原因を追えなくなった。

**配布する「ひどいコード」**: 2ファイル（片方は読むだけ）。

```ts
// examples/session-03/src/useCase/startExamination.ts（配布される素朴版）
export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): InExamination => {
    const appointment = deps.resolver.resolveById(input.appointmentId);
    if (appointment === undefined) throw new Error("Appointment not found");
    if (appointment.kind !== "CheckedIn")
      throw new Error("Invalid state: " + appointment.kind);
    return Appointment.startExamination(appointment, input.veterinarianId);
  };
```

```ts
// examples/session-03/src/web/startExaminationHandler.ts（読むだけ。修正しない）
try { ... } catch (error) {
  if (String(error).includes("not found")) return { status: 404 };
  return { status: 500 };   // ← 文言に依存した分岐
}
```

なぜ事故るか: 失敗の種類が関数の型に現れないため、呼び出し側はメッセージ文字列でしか分岐できない。文言を変えると分岐が静かに壊れ、コンパイラは何も言わない。

**受講者がリファクタする対象（ちょうど2関数）**:

| # | 関数 | 形式 | 作業 |
|---|---|---|---|
| 1 | `ensureCheckedIn` | 穴埋め | `(appointment: Appointment) => Result<CheckedIn, InvalidAppointmentState>` を実装する。型ガードの `Result` 版 |
| 2 | `startExamination` | リファクタ | `try/catch` と `throw` を捨て、戻り値を `Result<InExamination, StartExaminationError>` にして `ensureAppointmentFound(...).andThen(ensureCheckedIn).map(...)` のパイプラインに組み替える |

`StartExaminationError` の union 定義、`ensureAppointmentFound`、修正済みハンドラは配布する。ハンドラ側は「`switch (error.kind)` で網羅的に分岐でき、`default` で `assertNever` に落ちる」形を**読んで比べる**。

**到達する型/パターン**: `Result<T, E>`、`kind` を持つ plain object のエラー union、`ok` / `err`、`map` / `andThen` / `mapErr`、絞り込み付き `Result` を返す関数。**非同期（`ResultAsync`）は扱わない** — port は同期 `Result` を返すものとして定義する。

**`examples/final` の対応ファイル**: `src/useCase/errors.ts`、`src/useCase/startExaminationUseCase.ts`（非同期化前の骨格として読む）、`src/adaptor/primary/web/middleware/useCaseResponse.ts`。

**GREEN の判定**: `pnpm exercise:03` が緑。判定条件は (a) 予約なし・状態不正の両方で `err` の `kind` が正しい、(b) 失敗経路で `Appointment.startExamination` が呼ばれていない（フェイク port の呼び出し回数で検証）。

**時間内訳**: 事故報告＋RED 5分 / `Result` とエラー union の解説 8分 / 演習 13分 / GREEN・解説・振り返り 4分 = **30分**。

---

### 3.4 Session 04 — 副作用を外に出す（30分）

**要求**: 誰が・いつ診察を開始したかを、あとから追えるようにしたい。

**事故**:

1. **テストが日によって落ちる**: `new Date().toISOString()` と `crypto.randomUUID()` がユースケースの中にあり、期待値を固定できなくなっていた。
2. **記録のない状態変更**: 保存が「状態を保存」→「記録を追加」の2回に分かれており、間で失敗すると状態だけ変わって記録が残らない予約が生まれた（dual-write）。

**配布する「ひどいコード」**:

```ts
// examples/session-04/src/useCase/startExamination.ts（配布される素朴版）
    const event = {
      kind: "ExaminationStarted",
      eventId: crypto.randomUUID(),          // ← 非決定性がユースケースの中
      occurredAt: new Date().toISOString(),  // ← 同上
      appointmentId: next.appointmentId,
      veterinarianId: input.veterinarianId,
    };
    deps.store.save(next);        // ① 状態を保存
    deps.eventLog.push(event);    // ② 記録を追加。ここで落ちると①だけが残る
    return ok(next);
```

なぜ事故るか: 非決定性がドメイン側にあるためテストが決定的にならない。書き込みが2回に分かれているため、片方だけ成功した中間状態が観測できてしまう。

**受講者がリファクタする対象（ちょうど2関数）**:

| # | 関数 | 形式 | 作業 |
|---|---|---|---|
| 1 | `startExamination` | リファクタ | `Dependencies` から `clock` / `eventIdGenerator` を受け取り `EventContext` を組み立て、純粋な `Appointment.startExamination(context)(checkedIn, veterinarianId)` を呼ぶ。保存は `store.store(event)` の1回にする |
| 2 | `InMemoryAppointmentStore.store` | 穴埋め | `store(event: ExaminationStarted): Result<void, RepositoryError>` を実装し、`event.aggregateState` と `event` を同時に書く。失敗時はどちらも書かない |

`Clock` / `EventIdGenerator` / `EventContext` の型、`ExaminationStarted` の型、カリー化された `Appointment.startExamination(context)(...)`、合成ルート `src/main.ts` は配布する。

**到達する型/パターン**: 1メソッド port、非決定性の注入、`(context) => (state) => Event` のカリー化、最小の型付きドメインイベント（`kind` / `eventId` / `occurredAt` / `aggregateState` / `payload`）、dual-write の解消。合成ルートは配布コードを読む。

**`examples/final` の対応ファイル**: `src/domain/aggregate/clock.ts`、`src/domain/aggregate/eventIdGenerator.ts`、`src/domain/aggregate/eventContext.ts`、`src/domain/aggregate/aggregateStore.ts`、`src/domain/appointment/appointmentStores.ts`、`src/adaptor/secondary/sqlite/store/appointmentEventStore.ts`、`src/app.ts`。

**GREEN の判定**: `pnpm exercise:04` が緑。判定条件は (a) 偽 `clock` / 偽 `eventIdGenerator` を渡すと結果が完全に決定的、(b) 保存を失敗させるフェイクを渡すと状態も記録も残らない。

**時間内訳**: 事故報告＋RED 5分 / port と注入・イベント・dual-write の解説 8分 / 演習 12分 / GREEN・解説・振り返り 5分 = **30分**。

---

### 3.5 Final — 参照実装ツアー（10分・講師デモ）

参加者は環境構築をしない。講師が画面で `examples/final` を開き、S1〜S4 で書いた4つの形が実アプリでどう現れるかを順に指す。最後に「1.3 お土産の届け方」の4差分表を示し、サイトの該当節へ誘導する。

**時間内訳**: デモ 7分 / お土産と自習導線の案内 3分 = **10分**。

---

## 4. `examples/` の新ディレクトリ構成

### 4.1 構成

```
examples/
  session-00/   # 引き継ぎ。legacy 一式（演習なし）
  session-01/   # 状態      開始点 = 00 の legacy + 配布 union + 素朴な遷移関数
  session-02/   # 境界      開始点 = 01 の解答を含む
  session-03/   # 失敗      開始点 = 02 の解答を含む
  session-04/   # 副作用    開始点 = 03 の解答を含む
  session-05/   # 到達点    = 04 の解答（exercises なし）
  final/        # 参照実装（変更しない）
```

`session-05` はセッションではなく**到達点スナップショット**である。サイトの catalog には載せない。役割は (a) Session 04 の答え合わせ、(b) 「今日の到達点」として持ち帰る単一のプロジェクト、(c) 全演習の解答の所在を一意にすること。現行の「最終演習の正解がどこにも存在しない」欠陥（調査 #4）を構造的に解消する。

ディレクトリ名 `session-0N` は据え置く。workspace 名 `@fp-with-ts/clinic-session-0N`、root scripts、`apps/docs` の raw glob、worker のリダイレクトが全てこの規約に乗っており、改名の利得が小さい。

### 4.2 `src` / `test` / `exercises` の枠組み — 維持する

現行の3分割と `vitest.config.ts`（`test/**` のみ）／ `vitest.exercises.config.ts`（`exercises/**` のみ）は**そのまま維持する**。理由:

- 「通常テストで確認する健全性と、教材で意図的に失敗させる演習を区別する」は PRD の品質要件かつ `AGENTS.md` の教材不変条件であり、この2ファイル構成がそれを最小のコストで実現している。
- 6セッション全てで両 config がバイト単位で同一であり、増減しても複製コストがない。
- `apps/docs` の `run-command.ts` が `exercises/**` と `test/**` でコマンドを出し分ける実装に依存している。

変更するのは中身の規約だけ。

| 項目 | 現行 | 新 |
|---|---|---|
| `src/` | 演習で参加者が**新規作成**する（存在しない） | 演習対象ファイルは**必ず存在**し、素朴な実装または `// TODO` の穴が入っている |
| `exercises/` | 未存在ファイルへの dynamic import。赤の理由がモジュール解決エラー | 実在ファイルを static import。赤の理由が assertion 失敗（何を要求されているか読める） |
| `test/` | セットアップ確認のみ | セットアップ確認＋**前セッションの演習テストを回帰として持ち越す** |
| `tsconfig.json` の include | `src` / `test` / `vitest.config.ts` | `exercises/**/*.ts` と `vitest.exercises.config.ts` を追加 |
| `package.json` の script | `build` / `typecheck` / `test` / `exercise` | `build` を削除（`tsc --noEmit` の別名でしかなく、final の `build` と意味が違う） |
| 依存 | 演習に必要な依存が入っていない回がある | S2 以降に `zod`、S3 以降に `neverthrow`、S2 以降に `@types/node`（`util.inspect` 検証のため） |

### 4.3 セッション間の連鎖の担保

**規約**: `session-0N/exercises/**` の期待値は、`session-0(N+1)/src/**` に対して緑になる。

**担保方法**: `session-0(N+1)/test/regression/` に、`session-0N` の演習テストを回帰テストとして**そのまま持ち越す**。これにより:

- `pnpm --filter @fp-with-ts/clinic-session-0(N+1) test` が既存の `vitest.config.ts`（`test/**`）で自動的に連鎖を検証する。追加のスクリプトも CI ジョブも要らない。
- 「session-03 → 04 の `safeParse` → `parse` 隠れ改修」（調査 #7）のような差分は、持ち越した回帰テストが落ちるので混入できない。
- 参加者が自分の答えと次スナップショットを突き合わせられる。

累積の結果、`session-05/test/regression/` には S1〜S4 の全演習テストが揃い、「到達点が今日学んだ全部を満たしている」ことが1コマンドで示せる。

**副次的な規約**: 各セッションの `README.md` は「このディレクトリは Session NN の**開始**スナップショットである。解答は `examples/session-0(N+1)/src` にある」の形式で統一する。これが現行の番号ずれ（調査 #5）の恒久対策になる。

### 4.4 演習の RED を「情報のある赤」にする

現行の RED はモジュール解決エラーであり、`expect` が何を要求しているかはテスト本文を読まないと分からない。新構成では演習対象ファイルが必ず存在するので、赤は必ず assertion 失敗になる。加えて演習テストは次を守る。

- 各 `it` の名前を業務の言葉で書く（例: 「会計済みの来院は診察を開始できない」）。
- 型レベルの禁止は `// @ts-expect-error` で表明し、`pnpm typecheck` で検証する（`exercises/**` を include に入れたことで初めて機能する）。
- 副作用が**起きていないこと**を明示的にテスト名に書く（例: 「失敗時は store へ書かない」）。`examples/final` のテスト命名規約を踏襲する。

---

## 5. `apps/docs` の再構成

### 5.1 content collection を導入するか — 導入しない

**判断: 導入しない。** ユーザーが挙げた痛み（セッション数を変えるとページを手で足す）は、content collection ではなく **catalog 駆動の動的ルート**で解く。

| 理由 | 内容 |
|---|---|
| 1 | 2026-08-06 に「Astro Content Collections、MDX、外部 CMS による本文構造化」を明示的に対象外と決定済みで、その理由（各セッションを教材として改善する自由度を優先し、本文を先回りして共通スキーマへ閉じ込めない）は今も有効 |
| 2 | 教材本文は Markdown/MDX の表現力を超える。吹き出し会話（`.onboarding-story`）、来院タイムライン（`.visit-timeline`）、ガイド付き Monaco、WebContainer playground はいずれも `.astro` のテンプレートと island で書かれている |
| 3 | content collection のスキーマ定義には `zod` が要るが、`apps/docs` の依存は現在 `@astrojs/react` / `@webcontainer/api` / `astro` / `monaco-editor` / `react` / `react-dom` の6つで zod を含まない。19日の残期間で依存とビルドの検証を増やす利得がない |
| 4 | ページ数の手作業は動的ルートで消える。本文の置き場所を変える必要はない |

**代わりに採る案（フェーズ2）**: `src/pages/sessions/[slug].astro` を1枚だけ置き、`getStaticPaths` を `catalog.ts` から生成する。本文は `src/sessions/content/<slug>.astro` に置き、`import.meta.glob("../../sessions/content/*.astro", { eager: true })` で対応コンポーネントを解決して描画する。これで catalog が唯一の真実になり、`site-contract.test.ts` の「ページ glob と catalog が一致すること」というテスト自体が不要になる（構造的に一致するため）。

**リスクと退避**: Astro 4 で `.astro` を `import.meta.glob` の eager import で受け取り動的コンポーネントとして描画する経路は、本設計時点で実機検証していない（推測を含む）。実装フェーズの最初に技術検証を行い、通らなければ **フェーズ1の形（セッションごとに1枚の `.astro`、計6枚）で確定**する。フェーズ1でも catalog スキーマ刷新・章骨格の構造化・テストの作り直しはすべて成立するので、当日までのクリティカルパスには乗せない。

### 5.2 セッションページのテンプレート／セクション骨格

全セッション共通の5章。`SessionLayout` が章定義を受け取り、**TOC を自動生成する**（現行の手書き `<ol slot="toc">` を廃止）。

| # | 章 id | 見出し | 中身 | orientation / reference の扱い |
|---|---|---|---|---|
| 1 | `#incident` | 何が起きたか | 要求 / 事故 / 守る不変条件 / 今回のミッション | 全 kind で必須 |
| 2 | `#legacy` | 配布コードを読む | 素朴な実装のどこが素朴かを `SessionCodeOverview`（読み取り専用ガイド）で指す | 全 kind で必須 |
| 3 | `#red` | 失敗を再現する | `CommandBlock phase="red"` ／ **編集する2関数の明示（`exerciseTargets` から生成）** ／ 先に読むファイル | `exercise` のみ |
| 4 | `#refactor` | 型で閉じる | 使う技法 / この技法の限界 / 編集可能な `SessionCodePlayground` / `CommandBlock phase="green"` | `exercise` のみ |
| 5 | `#review` | レビューと持ち帰り | レビュー観点 / 完了条件 / **`examples/final` の対応ファイル（`finalReferences` から生成）** / AI に依頼するときの約束 / 振り返り / 代替進行 | 全 kind で必須 |

現行の Session 00 と Final が他5ページと非対称だった問題（調査所見 #3）は、`kind` で章の有無を宣言することで解消する。`orientation` と `reference` は3章、`exercise` は5章。並びと id は kind ごとに固定する。

**編集対象を本文へ機械的に出す**のが今回の要点である。`exerciseTargets` に書いた `{ path, functionName, form }` を `#red` 章の表として描画し、テストで「要素数が2以下」「path が実在」「functionName がそのファイルに現れる」を検証する。最大2関数の制約が、運用ルールではなくビルドの制約になる。

### 5.3 `catalog.ts` の新スキーマ

```ts
export type SessionKind = "orientation" | "exercise" | "reference";

export type ExerciseTarget = Readonly<{
  path: string;           // "examples/session-01/src/domain/appointment.ts"
  functionName: string;   // "startExamination"
  form: "fill-in" | "refactor";
}>;

export type TimeBreakdown = Readonly<{
  brief: number;      // 事故提示と RED
  teach: number;      // 技法の解説
  exercise: number;   // 参加者が手を動かす
  debrief: number;    // GREEN・解答解説・振り返り
}>;

export type SessionSummary = Readonly<{
  slug: string;
  snapshot: ExampleSnapshot;
  sequence: "00" | "01" | "02" | "03" | "04" | "Final";
  kind: SessionKind;
  title: string;
  durationMinutes: number;
  timeBreakdown: TimeBreakdown;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
  incident: string;                            // 事故の1行
  invariant: string;                           // 守る不変条件の1行
  exerciseCommand?: string;                    // "pnpm exercise:01"
  exerciseTargets: readonly ExerciseTarget[];  // 0〜2 件
  finalReferences: readonly string[];          // examples/final の対応ファイル
}>;

export type ExampleSnapshot =
  | "session-00" | "session-01" | "session-02"
  | "session-03" | "session-04" | "session-05" | "final";
```

現行からの差分と理由:

| 変更 | 理由 |
|---|---|
| `label` を削除 | `animal.name` と重複し、どのページ・レイアウトからも参照されていない死にフィールド。`final` だけ値が食い違っている |
| `kind` を追加 | Session 00 と Final の非対称を「例外」ではなく「宣言された種別」にする。章骨格・テスト・playground の有無を kind で分岐できる |
| `timeBreakdown` を追加 | 時間配分を facilitator-guide と二重管理せず、catalog を唯一の真実にする。`brief + teach + exercise + debrief === durationMinutes` をテストで検算する |
| `incident` / `invariant` を追加 | 「技法からではなく要求・事故から始める」を、本文の書きぶりではなくデータで強制する。空文字を禁止する |
| `exerciseTargets` を追加 | **最大2関数をテストで機械的に強制する**。今回いちばん効く変更 |
| `finalReferences` を追加 | 「今日の型が final のどこにあるか」の対応を全セッションで欠かさない。パスの実在をテストで検証する |
| `exerciseCommand` を optional に | `kind !== "exercise"` の回にコマンドが無いことを型で表す。現行の「Session 00 に `pnpm exercise:00` を載せてはいけない」という暗黙ルールが型になる |
| `sequence` から `"05"` を削除 | セッションが5本になるため |
| `snapshot` に `"session-05"` を残す | 到達点スナップショットとして playground から参照するため。catalog の `sessions` 配列には含めない |

**カタログ不変条件テスト**（純ロジック、文言非依存）:

1. slug と sequence が一意で、配列の順が表示順である。
2. すべての要素で `timeBreakdown` の4値の和 = `durationMinutes`。
3. `sessions` の `durationMinutes` の合計 = 150。固定枠30分を足して180になることをコメントではなくアサーションで示す。
4. `kind === "exercise"` ⇔ `exerciseCommand !== undefined` かつ `1 <= exerciseTargets.length <= 2`。
5. `kind !== "exercise"` ⇒ `exerciseTargets.length === 0`。
6. `incident` と `invariant` が空でない。
7. `exerciseTargets[].path` と `finalReferences[]` が実ファイルとして存在し、`functionName` が対象ファイルに現れる。
8. `snapshot` に対応する `examples/<snapshot>/package.json` が存在する。

### 5.4 再利用する部品／捨てる部品

**そのまま再利用（変更なし）**

| 部品 | 理由 |
|---|---|
| `src/layouts/BaseLayout.astro` | html 骨格と h1 フォーカス script。無条件で使える |
| `src/components/CodeBlock.astro` / `CommandBlock.astro` / `CopyButton.tsx` | 教材固有ブロックとして完成している。`CommandBlock` の red/green は新骨格の `#red` / `#refactor` にそのまま乗る |
| `src/components/code-explorer/{CodeExplorer,FileTree,MonacoEditor,OutputPanel}.tsx` | DI が効いており、ガイドモード（読み取り専用）と編集モードの両方を持つ。新骨格の `#legacy`（ガイド）と `#refactor`（編集）にそのまま対応する |
| `src/code-explorer/{run-command,runner,types,code-guide}.ts` | UI 非依存の純ロジック。最も再利用価値が高い |
| `src/styles/sessions.css` の case-file テーマ、`.command-block--red/green`、table/dl 装飾、`.visit-timeline`、`.onboarding-story` | Session 00 の物語とタイムラインは新 Session 00 でも使う |
| `src/styles/code-playground.css` | `.case-file .code-playground` のトークン継承による文脈別テーマは踏襲価値がある |
| `e2e/home.spec.ts` とスクリーンショット2枚 | トップページ保護ルールの担保。触らない |

**Props 化・一般化して再利用**

| 部品 | 変更 |
|---|---|
| `src/components/code-explorer/SessionCodeOverview.astro` | Session 00 ハードコードをやめ、`slug` と `guides` を Props にする。全セッションの `#legacy` 章で使う |
| `src/code-explorer/onboarding-guides.ts` | `src/code-explorer/code-guides/<slug>.ts` に一般化。「現在の設計」「将来困り得ること」のデータモデル（`CodeGuide`）はそのまま |
| `src/code-explorer/project-files.ts` | glob の7行をスナップショット一覧から導出し、`session-05` を追加する。`tsx` 注入と `tsconfig.extends` の平坦化はそのまま |
| `src/code-explorer/session-workspaces.ts` | 新 slug に合わせて定義し直す。ビルド時の3不変条件検査（slug 存在・initialFile ∈ visibleFiles・visibleFiles ⊆ projectFiles）は維持 |
| `scripts/verify-static-build.mjs` | 必須 HTML リストのハードコードをやめ、catalog から導出する。「余分な HTML の禁止」検査は維持 |
| `src/layouts/SessionLayout.astro` | 章定義から TOC を自動生成し、`kind` で章構成を分岐する。TOC を desktop / mobile の2箇所に描画する現行方式は維持（テストの期待値も維持） |

**捨てる**

| 対象 | 理由 |
|---|---|
| `src/pages/code-explorer.astro` と `/code-explorer/` ルート | Session 00 固定のハードコードで、サイト内のどこからもリンクされていない孤立ページ。汎用化した `SessionCodeOverview` が役割を吸収する。`public/_headers` と `astro.config.ts` の `isolationHeaders`、`verify-static-build.mjs` の allowedPaths を3点同期して削除する |
| `src/styles/code-explorer-preview.css`（74行） | 上記ページ専用 |
| `src/styles/base.css` の `.module-page` / `.module-hero` / `.module-page__eyebrow` / `.module-toc` / `.toc` / `.checklist-block` / `.file-table-block` / `.module-cards` / `.module-card-marker` / `.module-navigation` / `.home-hero` | どの `.astro` / `.tsx` からも参照がない死にコード（"module-" が58行に出現） |
| `src/styles/sessions.css` の `.requirement-dialogue*` / `.requirement-prompt`（323-380行） | 旧バージョンの残骸で未使用 |
| catalog の `label` フィールド | 死にフィールド |
| `src/pages/sessions/04-agent-review.astro` / `05-mini-integration.astro` | セッション廃止 |

### 5.5 壊れやすいページテストの作り直し

**現行の問題**: `final.test.ts` は40近い literal（`"Node v25.4.0"`、`"NODE_ENV を指定せず"`、`"Scheduled → CheckedIn → InExamination → AwaitingPayment → Paid"` など）を要求し、レンダリングせずソース文字列一致だけで検証する。`sessions-01-02.test.ts` / `sessions-03-04.test.ts` / `session-05.test.ts` は `.astro` の生ソースを正規表現で検査する。`session-00.test.ts` は3つの発話を完全一致で固定する。文言を1文字変えると大量に落ち、再設計コストが最も高い箇所である。

**新方針**: 文言ではなく **catalog と本文の対応関係** を検証する。テストは「本文がこう書いてあるか」ではなく「catalog に宣言したことがページに現れているか」を見る。

| # | テスト | 何を検証するか | 文言依存 |
|---|---|---|---|
| 1 | `src/sessions/catalog.test.ts` | 5.3 の不変条件8件。レンダリングしない純ロジック | なし |
| 2 | `src/test/pages/session-structure.test.ts`（**全セッションをパラメタライズド**） | 章 id の並びが `kind` ごとの規定骨格と一致 / TOC リンクが章数×2 で href が一意 / 各 href に対応する `article h2#id` がちょうど1つ / `h1` が catalog の `title` と一致 | catalog 由来のみ |
| 3 | `src/test/pages/session-exercise.test.ts`（`kind === "exercise"` のみ） | red と green の `CommandBlock` が `exerciseCommand` と一致して両方ある / `exerciseTargets` の各 `path` と `functionName` が本文に現れる / `finalReferences` の各パスが本文に現れる | catalog 由来のみ |
| 4 | `src/test/examples/catalog-references.test.ts` | `exerciseTargets[].path` と `finalReferences[]` が実ファイルで、`functionName` がそのファイルに含まれる | なし（実ソース照合） |
| 5 | `src/code-explorer/session-workspaces.test.ts`（既存を更新） | 全 slug の snapshot 対応 / visibleFiles の実在と重複なし / **次スナップショットの解答ファイルが projectFiles に含まれないこと** | なし |
| 6 | `src/code-explorer/code-guides/*.test.ts`（既存 `onboarding-guides.test.ts` を一般化） | 各ガイドの強調行範囲を実ソースから切り出し、期待するコード断片を含むこと | 教材ソース由来 |
| 7 | `src/test/pages/index.test.ts`（既存） | トップページの構造凍結。保護対象なので維持 | 維持 |

**廃止**: `final.test.ts` の literal 群、`session-00.test.ts` の発話完全一致、`sessions-01-02` / `sessions-03-04` / `session-05` の生ソース正規表現、`code-explorer.test.ts`（ページ廃止）。`site-contract.test.ts` はフェーズ2（動的ルート化）で不要になるため、フェーズ1では「catalog の slug 集合とページ glob が一致」の1アサーションだけ残す。

**この方針の効果**: 教材の文言は当日直前まで直せる。落ちるのは「catalog に宣言したことをページに書き忘れたとき」だけになる。リグレッション防御を落とさずに再設計コストを下げる交換になっている。

**e2e**: `session-code-playground.spec.ts` と `session-semantic-content.spec.ts` を catalog 駆動のパラメタライズドに書き換える（検証内容 — playground の可視性、横スクロールが発生しないこと、dl / table の可読性 — は維持）。`home.spec.ts` の視覚回帰は触らない。

---

## 6. 移行計画

### 6.1 `examples/`

| ファイル / ディレクトリ | 分類 | 移行後 |
|---|---|---|
| `examples/final/**`（173 files） | **残す（凍結）** | 一切変更しない |
| `examples/session-00/src/appointment.ts` | 残す（移設） | `session-00/src/legacy/appointment.ts`。`session-01` にも同梱し「直す前」を参照可能に |
| `examples/session-00/src/logger.ts` | 残す（移設） | `session-00/src/legacy/logger.ts` |
| `examples/session-00/test/setup.test.ts` | 残す | 環境確認テスト。全セッションに複製する規約は維持 |
| `examples/session-00/exercises/incident.test.ts` | 書き直す | `session-01/exercises/state-modeling.test.ts` の一部へ。Session 01 の RED として二重請求を再現する |
| `examples/session-01/src/visit-lifecycle.ts` | **捨てる** | 「要求の固定」を定数で表す層は、S1 の本文（`incident` / `invariant`）へ移す |
| `examples/session-01/test/incident-requirements.test.ts` | **捨てる** | 上と同じ理由 |
| `examples/session-02/src/domain/appointment.ts` | 残す（素材） | 新 `session-01/src/domain/appointment.ts` の union 定義として流用。遷移関数だけ素朴版へ差し替える |
| `examples/session-02/test/state-modeling.test.ts` | 残す（素材） | `@ts-expect-error` 節を含め、新 `session-02/test/regression/` へ持ち越す |
| `examples/session-02/exercises/boundary-and-ids.test.ts` | 書き直す | 実在ファイルへの static import に変え、`[REDACTED]` と ID 取り違えの3条件を検証する形へ |
| `examples/session-03/src/domain/*Id.ts`（5個） | 残す（素材） | `safeParse` を捨て `parse: schemaResult(...)` に統一して新 `session-02` の解答（= `session-03/src`）へ |
| `examples/session-03/src/boundary/{exam-result,owner-contact}.ts` | 残す（素材） | 同上。素朴版を `session-02/src/boundary/` に、解答を `session-03/src/boundary/` に置く |
| `examples/session-03/src/shared/sensitive.ts` | 残す | `[Symbol.for("nodejs.util.inspect.custom")]` 付き（現 session-05 版）に統一して S2 から配布 |
| `examples/session-03/exercises/result-errors.test.ts` | 書き直す | `ensureCheckedIn` と `startExamination` の2関数に対する assertion へ |
| `examples/session-04/src/shared/schema-result.ts` | 残す | S2 から配布する `schemaResult` として。名前を `schemaResult.ts` に統一 |
| `examples/session-04/src/application/start-examination.ts` | 書き直す | dual-write を含む素朴版を `session-04/src/useCase/startExamination.ts` へ。Result 化前の版を `session-03` へ |
| `examples/session-04/src/review/agent-review.ts` | **捨てる** | セッション廃止 |
| `examples/session-04/exercises/agent-review.test.ts` | **捨てる** | 同上 |
| `examples/session-05/src/ports/{appointment-resolver,appointment-store}.ts` | 残す（素材） | 1メソッド port として新 `session-04` の題材へ |
| `examples/session-05/src/shared/sensitive.ts` | 残す | inspect 対応版。上の統一先 |
| `examples/session-05/test/fixtures.ts` | 残す（拡大） | 全セッション共通の fixture 規約へ格上げ |
| `examples/session-05/exercises/follow-up.test.ts` | **捨てる** | シグネチャが `examples/final` に存在せず、15分で完走不能（調査 #4） |
| 全 `examples/session-0N/vitest.config.ts` / `vitest.exercises.config.ts` | 残す | バイト単位で同一のまま複製 |
| 全 `examples/session-0N/tsconfig.json` | 書き直す | include に `exercises/**/*.ts` と `vitest.exercises.config.ts` を追加（調査 #6） |
| 全 `examples/session-0N/package.json` | 書き直す | `build` script 削除（調査 #16）、依存を演習に合わせて追加（調査 #1・#2） |
| 全 `examples/session-0N/README.md` | 書き直す | 「Session NN の開始スナップショット。解答は session-0(N+1)」形式で統一（調査 #5） |
| `examples/session-05/`（ディレクトリ全体） | 書き直す（役割変更） | 到達点スナップショット。`exercises/` を持たず、`test/regression/` に S1〜S4 の全演習テストを持つ |

### 6.2 `apps/docs/`

| ファイル | 分類 | 移行後 |
|---|---|---|
| `src/layouts/BaseLayout.astro` | 残す | 変更なし |
| `src/layouts/SessionLayout.astro` | 書き直す | 章定義からの TOC 自動生成、`kind` による章分岐 |
| `src/sessions/catalog.ts` | 書き直す | 5.3 の新スキーマ |
| `src/sessions/catalog.test.ts` | 書き直す | 不変条件8件 |
| `src/pages/index.astro` | 残す（最小差分） | セッション一覧の件数と slug のみ catalog に追従。**見た目・文章・情報量・主要導線は変更しない**（トップページ保護） |
| `src/pages/404.astro` | 残す | リンク先 slug のみ確認 |
| `src/pages/code-explorer.astro` | **捨てる** | 孤立ページ |
| `src/pages/sessions/00-onboarding.astro` | 書き直す | 20分・3章骨格・2件の事故報告 |
| `src/pages/sessions/01-state-modeling.astro` | 書き直す | 5章骨格 |
| `src/pages/sessions/02-boundary-and-ids.astro` | 書き直す | 5章骨格 |
| `src/pages/sessions/03-result-errors.astro` | 書き直す | 5章骨格 |
| `src/pages/sessions/04-agent-review.astro` | **捨てる** | → `04-effects-and-events.astro` を新規作成 |
| `src/pages/sessions/05-mini-integration.astro` | **捨てる** | セッション廃止 |
| `src/pages/sessions/final.astro` | 書き直す | 3章骨格＋「今日の到達点から final までの4つの差分」節 |
| `src/components/{CodeBlock,CommandBlock}.astro`, `CopyButton.tsx` | 残す | 変更なし |
| `src/components/code-explorer/{CodeExplorer,FileTree,MonacoEditor,OutputPanel}.tsx` | 残す | 変更なし |
| `src/components/code-explorer/SessionCodeOverview.astro` | 書き直す | `slug` / `guides` を Props 化 |
| `src/components/code-explorer/SessionCodePlayground.astro` | 残す | 変更なし |
| `src/code-explorer/{run-command,runner,types,code-guide}.ts` | 残す | 変更なし |
| `src/code-explorer/project-files.ts` | 書き直す | glob をスナップショット一覧から導出、`session-05` 追加 |
| `src/code-explorer/session-workspaces.ts` | 書き直す | 新 slug・新 visibleFiles |
| `src/code-explorer/onboarding-guides.ts` | 書き直す | `code-guides/<slug>.ts` へ一般化 |
| `src/styles/base.css` | 書き直す（削減） | 死にセレクタ削除。トップページ用の725行目以降は触らない |
| `src/styles/sessions.css` | 残す（追補） | `.requirement-dialogue*` を削除、章骨格用の見出しスタイルを追加 |
| `src/styles/code-playground.css` | 残す | 変更なし |
| `src/styles/code-explorer-preview.css` | **捨てる** | ページ廃止 |
| `src/test/pages/sessions/{session-00,sessions-01-02,sessions-03-04,session-05,final}.test.ts` | **捨てる** | → `session-structure.test.ts` + `session-exercise.test.ts` の2本へ |
| `src/test/pages/sessions/code-playground.test.ts` | 書き直す | catalog 駆動のパラメタライズドへ統合 |
| `src/test/pages/site-contract.test.ts` | 書き直す | フェーズ1では1アサーションに縮小、フェーズ2で廃止 |
| `src/test/pages/code-explorer.test.ts` | **捨てる** | ページ廃止 |
| `src/test/pages/index.test.ts` | 残す | トップページ構造凍結を維持 |
| `src/test/layouts/SessionLayout.test.ts` | 書き直す | TOC 自動生成と `kind` 分岐の検証へ |
| `src/test/config/isolation-headers.test.ts` | 残す（微修正） | `/code-explorer/*` の行を削除 |
| `src/test/render-astro.ts` | 残す | 変更なし |
| `e2e/home.spec.ts` と `__screenshots__/*.png` | 残す | 触らない |
| `e2e/session-code-playground.spec.ts` | 書き直す | catalog 駆動 |
| `e2e/session-semantic-content.spec.ts` | 書き直す | catalog 駆動 |
| `scripts/verify-static-build.mjs` | 書き直す | 必須 HTML を catalog から導出、`/code-explorer/` を削除 |
| `public/_headers` | 書き直す | `/code-explorer/*` の行を削除 |
| `astro.config.ts` | 書き直す | `isolationHeaders` から `/code-explorer/*` を削除 |
| `AGENTS.md` | 書き直す | `src/pages/modules/*.astro` / `src/modules/catalog.ts` という実在しない参照を修正し、語彙を「セッション」に統一 |

### 6.3 リポジトリ直下・運営文書

| ファイル | 分類 | 移行後 |
|---|---|---|
| `AGENTS.md` | 書き直す | 「リポジトリ構成」の `packages/clinic-example/**` を `examples/**` に修正。`exercise:00` の説明を新形式（全演習が assertion 失敗で赤く始まる）に合わせる |
| `README.md` | 書き直す | セッション数、`exercise:00`〜`exercise:04`、番号ずれの解消 |
| `package.json` | 書き直す | `exercise:05` を削除、`exercise:00` を廃止（Session 00 に演習なし）し `exercise:01`〜`exercise:04` に。`test` から `examples/final` を除外し、参加者の `pnpm install` / `pnpm test` が `better-sqlite3` のネイティブビルドに依存しないようにする（PRD「DB 不要」との衝突の解消。`examples/final` 自体は変更しない） |
| `worker/routes.ts` | 書き直す | `/sessions/04-agent-review/` と `/sessions/05-mini-integration/` → `/sessions/04-effects-and-events/` を追加。既存の `00-*` リダイレクトと `/module-00` は維持 |
| `wrangler.jsonc` | 残す | 変更なし |
| `docs/prd/prd-001.md` | 書き直す（追補） | セッション表（6→5）、語彙（モジュール→セッション）、Session 00 の性格、final の位置づけを反映。PRD-06「最大2関数」は据え置き（本設計の中核制約） |
| `docs/event/facilitator-guide.md` | 書き直す | 2.1 のタイムテーブル、チェックポイントを新4演習に合わせる。**班と TA の運用**（各班 TA 1名、演習中の巡回、詰まりの拾い方、代替進行の切り替え判断）を追記 |
| `docs/event/participant-setup.md` | 書き直す | 対応ブラウザ（デスクトップ版 Chrome / Edge の現行版）を追記。`pnpm install` を事前に済ませる案内。オフライン会場の Wi-Fi 前提 |
| `docs/event/troubleshooting.md` | 残す（追補） | 新しい RED の見え方（assertion 失敗）に合わせて1項目追加 |
| `docs/superpowers/{specs,plans}/**`（39件） | 残す（履歴） | 過去の完了済み設計・計画は変更しない |
| `docs/design/animal-clinic-docs-mockup.html`, `.superdesign/**` | 残す | 参考モックアップ。サイト本体ではない |

---

## 7. 既知の欠陥の是正

実装フェーズを5段階に切り、各欠陥をどこで直すかを固定する。残り19日（2026-08-11 → 08-30）に対する目安日を併記する。

| フェーズ | 期間の目安 | 内容 |
|---|---|---|
| P0 前提整備 | 08-11 〜 08-12 | 本設計の合意。`AGENTS.md` 2本と PRD の追補 |
| P1 `examples/` 再構築 | 08-13 〜 08-20 | 5スナップショット + 到達点スナップショットの実装 |
| P2 `apps/docs` 再構築 | 08-18 〜 08-25 | catalog・章骨格・テスト・CSS 掃除（P1 と一部並行） |
| P3 運営文書 | 08-25 〜 08-27 | facilitator-guide / participant-setup / troubleshooting |
| P4 リハーサル | 08-27 〜 08-29 | 通し計測、TA 向け想定 QA、当日環境での実機確認 |

| # | 欠陥 | 深刻度 | 直すフェーズ | 直し方 |
|---|---|---|---|---|
| 1 | `examples/session-02/package.json` に `zod` がなく exercise:02 が完了不能 | 高 | **P1** | 新 `session-02` 以降に `zod` を依存として宣言。演習テストが依存を要求することを、スナップショット生成時のチェックリストに入れる |
| 2 | `examples/session-03/package.json` に `neverthrow` がなく exercise:03 が完了不能 | 高 | **P1** | 新 `session-03` 以降に `neverthrow` を宣言 |
| 3 | session-04 の演習が 04→05 の実差分を全くカバーしない | 高 | **P1** | 「エージェントレビュー」セッションを廃止し、dual-write 解消と非決定性の注入を Session 04 の主演習にする（3.4） |
| 4 | session-05 演習の解答が `examples/final` に存在しない | 高 | **P1** | `collectFollowUpTargets` 演習を廃止。全演習の解答を `session-0(N+1)/src` に置き、終端は `examples/session-05`（到達点スナップショット）が受ける（4.1） |
| 5 | README とサイトでセッション番号が1つずれる | 高 | **P1** | 全 README を「Session NN の開始スナップショット。解答は session-0(N+1)」形式に統一（4.3） |
| 6 | `exercises/**` が tsconfig の include 外 | 中 | **P1** | 全セッションの include に `exercises/**/*.ts` と `vitest.exercises.config.ts` を追加。`session-05/exercises/follow-up.test.ts:45` の `noUncheckedIndexedAccess` 違反は該当ファイル廃止で同時に消える |
| 7 | session-03→04 の `safeParse` → `parse` 隠れ改修（7ファイル） | 中 | **P1** | S2 の時点から `parse: schemaResult(...)` に統一し、`safeParse` 版を作らない。加えて回帰テスト持ち越し（4.3）により、以後この種の隠れ改修は構造的に混入できない |
| 8 | session-00 と session-01 が実質重複スナップショットで60分を消費 | 中 | **P1 / P2** | Session 00 を20分に圧縮し、`session-01` は「配布 union + 素朴な遷移関数」という独自の開始点を持つ（2.2、3.1） |
| 9 | `visit-lifecycle.ts` / `incident-requirements.test.ts` が session-02 以降に存在せずトレーサビリティが切れる | 中 | **P1** | 両ファイルを廃止し、要求と不変条件を catalog の `incident` / `invariant` としてサイト側で全セッションに一貫表示する（5.3） |
| 10 | サイト 02 / 03 に「作成対象ファイル」の明示がない | 中 | **P2** | `exerciseTargets` から `#red` 章の表を自動生成し、全セッションで欠落不能にする（5.2） |
| 11 | Session 00 ページと `pnpm exercise:00` の導線が不整合 | 中 | **P1 / P2** | `exercise:00` を廃止（Session 00 に演習なし）。`exerciseCommand` を optional にし、`kind !== "exercise"` にコマンドが存在しないことを型で表す |
| 12 | `session-04/src/application/start-examination.ts:15` の未使用 import | 低 | **P1** | 該当ファイルを書き直すため自然に消える。`typecheck` を全スナップショットで走らせて再発を防ぐ |
| 13 | `session-05/test/state-modeling.test.ts:12` の ownerId が他と食い違う | 低 | **P1** | `test/fixtures.ts` を全セッション共通の唯一の fixture にし、直値を禁止する |
| 14 | 05 の playground の visibleFiles が演習で使うファイルを含まない | 低 | **P2** | 新 workspace 定義で `exerciseTargets[].path` が必ず `visibleFiles` に含まれることをビルド時検査に追加 |
| 15 | 演習01の主題 `followUpRequestedAt` が final の `Canceled` にない | 低 | **P1** | 新 S1 の `Canceled` は `appointmentId` / `petId` / `ownerId` / `scheduledAt` / `reason: CancellationReason` / `canceledAt` とし、final と整合させる |
| 16 | `build` script が `tsc --noEmit` の別名 | 低 | **P1** | 全 examples から `build` を削除。root の `build` は docs のみを指す |
| 17 | `apps/docs/AGENTS.md` が実在しない `src/pages/modules/*` / `src/modules/catalog.ts` を参照 | 中 | **P0** | 実体（`src/pages/sessions/*` / `src/sessions/catalog.ts`）に修正し、語彙を「セッション」に統一 |
| 18 | ルート `AGENTS.md` が実在しない `packages/clinic-example/**` を参照 | 中 | **P0** | `examples/**` に修正 |
| 19 | root `pnpm test` が `examples/final` のネイティブ依存を引き、PRD「DB 不要」と衝突 | 中 | **P1** | root scripts の `test` / `typecheck` から `examples/final` を除外。`examples/final` 自体は変更しない |
| 20 | 参加者向け文書にブラウザ要件（Chrome / Edge、SharedArrayBuffer）の記載がない | 中 | **P3** | `participant-setup.md` に追記 |
| 21 | PRD が現行構成に追随していない（module 語彙、Session 00 の性格、セッション数） | 中 | **P0** | 本設計の合意後に PRD を追補。PRD-06（最大2関数）は据え置く |

---

## 8. リスクと未解決事項

### 8.1 180分に収まらないリスク

| リスク | 影響 | 緩和策 |
|---|---|---|
| 演習12〜13分は楽観的で、S3（`Result`）が最大の壁 | 後続セッションが押し出される | 各演習に**最小 GREEN** と**発展**を分ける。最小 GREEN は「2関数のうち穴埋め側だけを完成させる」で成立するようにテストを分割し、班の TA が「ここまでで次へ」を判断できる基準を facilitator-guide に明記する |
| Session 02 の技法密度が3つで最も高い | S2 で20分溢れると休憩が消える | 3.2 の判断ポイント（`Sensitive` を解説のみへ降格）をリハーサルで決める。降格しても S1・S3・S4 は影響を受けない |
| 会場 Wi-Fi での `pnpm install` 集中 | 冒頭10分の環境確認が破綻 | connpass の事前案内で clone + install を必須にする。当日は `pnpm test` が緑になることだけ確認する。Code Playground（WebContainer）は `npm install` にネットワークを要するため、**当日の主経路はローカル実行**とし、playground は予備・自習用と位置づける |
| 休憩が90分地点に1回のみ | 前半で集中が切れる | S1 と S2 の境界（16:00）で2分の小休止を講師の裁量枠として facilitator-guide に書く（タイムテーブルの数字は変えず、S2 の `brief` から捻出する） |

### 8.2 当日の詰まりポイント（TA 向け）

| セッション | 詰まる箇所（予測） | 拾い方 |
|---|---|---|
| S1 | `as const satisfies` を書く位置。`as` を外すとどこがエラーになるか読めない | 「エラーメッセージの `Property 'x' is missing` は、その状態で必須の項目を教えている」と読み方を先に教える |
| S2 | Zod の `.brand()` と `.transform()` の順序。`z.infer` の結果が読めない | 順序は「brand → transform」で固定と明言する。配布コードに1つ完成例（`AppointmentId`）を置く |
| S3 | `andThen` と `map` の使い分け。`Result` を返す関数を `map` に渡してネストする | 「関数が `Result` を返すなら `andThen`、素の値を返すなら `map`」の1行ルールをスライドに常掲する |
| S4 | `Dependencies` の分割代入と、カリー化された `Appointment.startExamination(context)(...)` の呼び出し形 | 呼び出し1行を配布コードのコメントに写経用として置く |
| 全般 | `verbatimModuleSyntax` による `import type` の要求、相対 import の `.js` suffix | troubleshooting に固定の2項目として載せ、TA が即答できるようにする |

### 8.3 実装フェーズで判断が必要な残論点

| # | 論点 | 選択肢 | 現時点の推奨 |
|---|---|---|---|
| 1 | `src/pages/sessions/[slug].astro` の動的ルート化 | (a) フェーズ2で実施 / (b) 手書き6枚のまま | **技術検証を先に行い、通れば (a)**。通らなければ (b) で当日までのクリティカルパスには乗せない（5.1） |
| 2 | 予約の状態数 | (a) 5状態（`AwaitingPayment` なし） / (b) final と同じ6状態 | **(a)**。6状態にすると union の要素と遷移関数が増え、演習の写経量が2関数の枠を圧迫する。final との差は Final ツアーで説明する |
| 3 | `Sensitive` を S2 の演習に残すか | (a) 演習2関数目に残す / (b) 解説のみに降格し別の穴埋めへ | **(a) で作り、リハーサルの実測で (b) に切り替えられるようにテストを分割しておく** |
| 4 | `examples/session-05`（到達点）を catalog に載せるか | (a) 載せない / (b) `kind: "reference"` で載せる | **(a)**。載せるとタイムテーブルにない7件目が再発する。Session 04 ページの `#review` 章から「答え合わせ」としてリンクする |
| 5 | PRD の改訂範囲 | (a) セッション表と語彙だけ追補 / (b) 全面改訂 | **(a)**。19日で PRD 全面改訂は割に合わず、PRD-01〜12 の要件本体は本設計と矛盾しない |
| 6 | 旧 URL のリダイレクト保持期間 | (a) 恒久 / (b) イベント後に整理 | **(a)**。worker の 2 エントリ追加で済み、コストがない |
| 7 | Code Playground を当日の主経路にするか | (a) ローカル実行が主・playground は予備 / (b) playground が主 | **(a)**。オフライン会場のネットワークに依存させない。参加者は事前 install 済みのローカルで演習する |
| 8 | 事故報告の提示媒体 | (a) サイト本文のみ / (b) 印刷した「事故報告書」を各班へ配る | **オフライン開催の利点として (b) を検討**。ただし成果物は設計ドキュメントのみのため、実装フェーズで運営側が判断する |

### 8.4 本設計で確認していないこと（推測を含む箇所）

- `import.meta.glob` による `.astro` の eager import と動的コンポーネント描画（5.1）は、Astro 4 のドキュメント上は可能と読めるが**本設計では実機検証していない**。8.3 #1 の技術検証項目とする。
- 演習1本あたり12〜13分という見積もりは、**実施実績のない推定値**である。現行教材の実測（exercise:01 で 114 行を30分）から「編集2関数・20〜30行なら12分」と外挿したもので、リハーサルでの計測が必須。
- 会場のネットワーク帯域・参加人数・貸与端末の有無は、リポジトリ内の全文書に記述がなく未確認。8.1 の緩和策は「事前 install 済み」を前提にしている。
- `node_modules` が未インストールのため、本設計の作成にあたって `pnpm test` / `pnpm build` は実行していない。既存の欠陥はすべてソースの読解と実ファイルの確認によって特定した（`session-02/package.json` の依存欠落、`session-03/package.json` の依存欠落、全 `tsconfig.json` の include、README の番号ずれ、`session-04/src/review/agent-review.ts` が TODO 1行であることは、いずれも本設計時に実ファイルで再確認済み）。

---

## 受け入れ条件

- 到達点が `examples/final` と区別して定義され、31概念の取捨が理由付きで表になっている。
- セッション構成が180分に収まり、固定枠30分＋セッション150分の内訳が数値で検算されている。
- 各セッションについて、要求・事故・配布する素朴なコード・**編集対象が最大2関数であること**・到達する型・`examples/final` の対応ファイル・時間内訳が示されている。
- `examples/` の新構成と、セッション間連鎖の機械的な担保方法（回帰テストの持ち越し）が示されている。
- content collection を導入するかの判断が理由付きで示され、`catalog.ts` の新スキーマ、章骨格、再利用／廃棄する部品、テストの作り直し方針が示されている。
- 現行資産の「残す／書き直す／捨てる」がファイル単位の表になっている。
- 調査で挙がった21件の欠陥に、それぞれ是正フェーズと方法が対応づけられている。
- リスクと未解決論点が、推測と事実を区別して記述されている。

## 検証方針

本設計は実装を伴わないため、検証は次の順で行う。

1. **合意形成**: 2.1 のタイムテーブル、1.2 の概念取捨、3章の各セッション設計をユーザーとレビューする。特に「エージェントレビュー」と「ミニ総合演習」の廃止、Session 00 の20分化、状態を5つに留める判断は明示的な承認を得る。
2. **技術検証（P2 の先頭）**: 8.3 #1 の動的ルートを最小構成で試し、フェーズ1／フェーズ2 のどちらで進めるかを確定する。
3. **実装計画の作成**: 承認後に `docs/superpowers/plans/` へ実装計画を作成し、P0〜P4 のタスクに落とす。
4. **リハーサル（P4）**: 4演習を実測し、12〜13分の見積もりを検証する。溢れた場合は 8.3 #3 の降格判断と、各演習の「最小 GREEN」の範囲を確定する。
5. **既存 CI の維持**: 実装フェーズを通じて `pnpm typecheck`、`pnpm test`、`pnpm build` が成功すること、およびトップページの視覚回帰（`e2e/home.spec.ts`）が変化しないことを各段階で確認する。
