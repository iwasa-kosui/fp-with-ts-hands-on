# MODULE 00-B 没入感のある要求導入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** MODULE 00-Bを、登場人物の具体的な要望から参加者の要求整理へ導く導入にする。

**Architecture:** 要求セクション内で、飼い主と受付スタッフの会話を意味的なコンテナにまとめ、その直後に参加者向けの問いかけを置く。既存の状態ごとのデータと不変条件の説明は後続に残し、レンダリングテストで会話・問いかけ・表示順を固定する。

**Tech Stack:** Astro、CSS、Vitest 2.1、happy-dom

## Global Constraints

- 目次とセクションIDの #requirement は維持する。
- 会話は飼い主、受付スタッフの順にDOMへ配置する。
- 飼い主はキャンセルと再診希望、受付スタッフはキャンセル理由と再診希望日を明示する。
- 会話の直後に「参加者のみなさんへ」と「要求を整理しよう」を含む問いかけを置く。
- 既存の Canceled のデータ要件と不変条件の説明は、問いかけの後に残す。
- 既存の --case-* カスタムプロパティだけを使用し、狭い画面でも横方向にはみ出さない。
- 環境の main ブランチ保護フックが worktree を誤判定するため、コミットは行わず、変更と検証結果をSDD ledgerに記録する。

---

### Task 1: 導入のレンダリング契約を追加する

**Files:**
- Modify: apps/docs/src/test/pages/modules/module-00.test.ts:107-120
- Test: apps/docs/src/test/pages/modules/module-00.test.ts

**Interfaces:**
- Consumes: ReadTheIncidentPage と parseStaticMarkup()。
- Produces: #requirement が会話コンテナ .requirement-dialogue、参加者向け .requirement-prompt、既存の状態説明を順に持つというレンダリング契約。

- [ ] **Step 1: 要求導入の失敗するテストを書く**

既存の turns the cancellation incident into the next modeling requirement ケースで、h2 の期待値を「要求を整理しよう」に変更し、以下を追加する。

    const requirement = document.querySelector("#requirement");
    const dialogue = requirement?.querySelector(".requirement-dialogue");
    const prompt = requirement?.querySelector(".requirement-prompt");

    expect(dialogue?.getAttribute("aria-label")).toBe("飼い主と受付スタッフの会話");
    expect(
      [...(dialogue?.querySelectorAll(".requirement-dialogue__speaker") ?? [])].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["飼い主", "受付スタッフ"]);
    expect(dialogue?.textContent).toContain("キャンセル");
    expect(dialogue?.textContent).toContain("再診希望");
    expect(dialogue?.textContent).toContain("キャンセル理由");
    expect(dialogue?.textContent).toContain("再診希望日");
    expect(prompt?.textContent).toContain("参加者のみなさんへ");
    expect(prompt?.textContent).toContain("要求を整理しよう");
    expect([...requirement?.children ?? []].indexOf(dialogue as Element)).toBeLessThan(
      [...requirement?.children ?? []].indexOf(prompt as Element),
    );

- [ ] **Step 2: テストが期待どおり失敗することを確認する**

Run: pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts

Expected: FAIL。見出しが一致しない、または .requirement-dialogue が見つからないため失敗する。

- [ ] **Step 3: 変更とテスト結果を ledger に記録する**

環境の保護フックを回避しない。変更ファイルと RED の失敗内容を、この計画専用の SDD ledger に記録する。

### Task 2: 会話と参加者への問いかけをページに追加する

**Files:**
- Modify: apps/docs/src/pages/modules/00-read-the-incident.astro:11-33
- Test: apps/docs/src/test/pages/modules/module-00.test.ts

**Interfaces:**
- Consumes: Task 1の .requirement-dialogue、.requirement-dialogue__speaker、.requirement-prompt のレンダリング契約。
- Produces: 飼い主・受付スタッフの会話と、要求整理へ促す参加者向け問いかけを持つ #requirement セクション。

- [ ] **Step 1: 要求セクションを最小実装する**

目次リンクとセクションIDを維持したまま、見出しを更新し、その直後に次の構造を置く。既存の Canceled の説明と不変条件はこの .requirement-prompt の後へ残す。

    <h2>要求を整理しよう</h2>
    <div class="requirement-dialogue" aria-label="飼い主と受付スタッフの会話">
      <div class="requirement-dialogue__line requirement-dialogue__line--owner">
        <p class="requirement-dialogue__speaker">飼い主</p>
        <p class="requirement-dialogue__bubble">予約をキャンセルしたいです。落ち着いたら再診もお願いできますか？</p>
      </div>
      <div class="requirement-dialogue__line requirement-dialogue__line--receptionist">
        <p class="requirement-dialogue__speaker">受付スタッフ</p>
        <p class="requirement-dialogue__bubble">承知しました。キャンセル理由と再診希望日を残して、次回の対応につなげましょう。</p>
      </div>
    </div>
    <p class="requirement-prompt"><strong>参加者のみなさんへ:</strong> この要望を安全に扱うには、まず要求を整理しよう。どの状態に、どの情報が必要でしょうか。</p>

- [ ] **Step 2: 導入テストが通ることを確認する**

Run: pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts

Expected: PASS。00-Bの要求導入に関するレンダリング契約を含む対象テストがすべて成功する。

- [ ] **Step 3: 変更とGREENの結果を ledger に記録する**

環境の保護フックを回避しない。変更ファイルと対象テストの成功結果を、この計画専用の SDD ledger に記録する。

### Task 3: 会話と問いかけを既存モジュールの視覚表現へ統合する

**Files:**
- Modify: apps/docs/src/styles/modules.css:195-
- Test: apps/docs/src/test/pages/modules/module-00.test.ts

**Interfaces:**
- Consumes: Task 2の requirement-dialogue、requirement-dialogue__line、requirement-dialogue__speaker、requirement-dialogue__bubble、requirement-prompt クラス。
- Produces: 左右に発話が分かれ、狭幅でもコンテナ内に収まる会話と、視線を止める参加者向け問いかけ。

- [ ] **Step 1: 最小の会話・問いかけスタイルを追加する**

modules.css の既存モジュール固有UIの近くに以下のルールを追加する。--case-* 以外の色値は追加しない。

    .requirement-dialogue {
      display: grid;
      gap: 0.75rem;
      margin-block: 1.5rem;
    }

    .requirement-dialogue__line {
      display: grid;
      gap: 0.25rem;
      max-width: 100%;
    }

    .requirement-dialogue__line--receptionist {
      justify-items: end;
    }

    .requirement-dialogue__speaker {
      margin: 0;
      font-weight: 700;
    }

    .requirement-dialogue__bubble {
      position: relative;
      max-width: min(100%, 34rem);
      margin: 0;
      padding: 0.75rem 1rem;
      border: 2px solid var(--case-line);
      border-radius: 1rem;
      background: var(--case-lemon);
    }

    .requirement-dialogue__bubble::after {
      position: absolute;
      bottom: -0.5rem;
      left: 1rem;
      width: 0;
      height: 0;
      border: 0.5rem solid transparent;
      border-top-color: var(--case-line);
      border-bottom: 0;
      content: "";
    }

    .requirement-dialogue__line--receptionist .requirement-dialogue__bubble {
      background: var(--case-mint);
    }

    .requirement-dialogue__line--receptionist .requirement-dialogue__bubble::after {
      right: 1rem;
      left: auto;
    }

    .requirement-prompt {
      margin-block: 1.5rem;
      padding: 1rem;
      border-inline-start: 0.35rem solid var(--case-coral);
      background: var(--case-lemon);
    }

- [ ] **Step 2: 対象テストと文書サイトのビルドを確認する**

Run: pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts && pnpm --filter @fp-with-ts/docs build

Expected: PASS。テストとAstroビルドがどちらも成功し、CSSセレクタ名の不整合やビルドエラーがない。

- [ ] **Step 3: スタイル変更と検証結果を ledger に記録する**

環境の保護フックを回避しない。変更ファイルと対象テスト・ビルドの成功結果を、この計画専用の SDD ledger に記録する。

### Task 4: 最終差分を検証する

**Files:**
- Verify: apps/docs/src/pages/modules/00-read-the-incident.astro
- Verify: apps/docs/src/styles/modules.css
- Verify: apps/docs/src/test/pages/modules/module-00.test.ts

**Interfaces:**
- Consumes: Tasks 1–3 の導入、スタイル、レンダリング契約。
- Produces: 既存の状態モデリング演習へつながる、検証済みの没入感ある00-B導入。

- [ ] **Step 1: 最終テストを実行する**

Run: pnpm --filter @fp-with-ts/docs test -- src/test/pages/modules/module-00.test.ts && pnpm --filter @fp-with-ts/docs build

Expected: PASS。対象テストとドキュメントサイトのビルドが成功する。

- [ ] **Step 2: 差分を確認する**

Run: git diff --check && git diff -- apps/docs/src/pages/modules/00-read-the-incident.astro apps/docs/src/styles/modules.css apps/docs/src/test/pages/modules/module-00.test.ts

Expected: whitespace errorがなく、差分は承認済みの会話、問いかけ、スタイル、レンダリングテストだけである。

- [ ] **Step 3: 完了結果を ledger に記録する**

環境の保護フックを回避しない。最終テストと差分確認の結果を、この計画専用の SDD ledger に記録する。
