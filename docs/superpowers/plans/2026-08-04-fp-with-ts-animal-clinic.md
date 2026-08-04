# 関数型ドメインモデリングハンズオン with TypeScript 実装計画

> **エージェント実装者向け:** この計画をタスク単位で実装するときは、superpowers:subagent-driven-development（推奨）または superpowers:executing-plans を使う。進捗管理には `- [ ]` のチェックボックスを使う。

**ゴール:** 2026-08-30 のハンズオンイベントで使う、動物病院 example と Cloudflare Workers 配信のかわいいドキュメントサイトを構築する。

**アーキテクチャ:** pnpm workspace に `apps/docs` と `packages/clinic-example` を同居させる。docs は Vite が静的 assets を生成し、Worker は `/healthz` 以外を `ASSETS.fetch` に委譲する。example は DB なしの TypeScript + Vitest で、参加者がまず事故を起こし、その事故を状態遷移、境界、失敗処理、AI エージェントレビューの順で封じ込める。

**技術スタック:** pnpm, TypeScript, Vite, Vitest, Zod, Cloudflare Workers Static Assets, Wrangler

## 全体制約

- 対象者は TypeScript 初級から中級。基本文法が書ける前提で、複雑な型テクニックは避ける。
- 当日準備は Node.js、pnpm、GitHub clone のみ。DB、Docker、外部 API key は要求しない。
- ドキュメント生成ツールは使わない。docs は Vite + TypeScript + 手書き content module で実装する。
- Cloudflare Workers で配信する。`assets.directory` は `apps/docs/dist` にする。
- ドメイン型は `type`、`kind` discriminant、Readonly、Companion Object、関数プロパティ記法を使う。
- `as` は原則禁止。Zod brand または `@ts-expect-error` の型テスト目的以外では使わない。
- UI は動物病院らしいかわいさを持たせるが、教材本文とコードの可読性を最優先する。
- 通常の `pnpm test` はセットアップ確認用として常に緑にする。module 開始時に赤くなるテストは `exercise:*` script で明示的に実行する。
- 各 module で参加者が書くコードは1〜2関数に制限する。残りは worked example または optional exercise に置く。
- 各 module は `インシデント -> 赤テスト -> 編集 -> 緑テスト -> エージェントレビュー` の固定フォーマットにする。

---

### タスク 1: ワークスペースの雛形作成

**ファイル:**
- 作成: `package.json`
- 作成: `pnpm-workspace.yaml`
- 作成: `tsconfig.base.json`
- 作成: `.gitignore`
- 変更: `README.md`

**インターフェース:**
- 提供: root script `dev`, `build`, `test`, `typecheck`, `preview`
- 提供: workspace package name `@fp-with-ts/docs` と `@fp-with-ts/clinic-example`

- [ ] **ステップ 1: root package metadata を作成する**

`package.json` を追加する:

```json
{
  "name": "fp-with-ts-hands-on",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "関数型ドメインモデリングハンズオン with TypeScript のサンプルコードとドキュメントサイト",
  "scripts": {
    "dev": "pnpm --filter @fp-with-ts/docs dev",
    "build": "pnpm --filter @fp-with-ts/clinic-example build && pnpm --filter @fp-with-ts/docs build",
    "test": "pnpm --filter @fp-with-ts/clinic-example test",
    "exercise:00": "pnpm --filter @fp-with-ts/clinic-example exercise:00",
    "typecheck": "pnpm --filter @fp-with-ts/clinic-example typecheck && pnpm --filter @fp-with-ts/docs typecheck",
    "preview": "pnpm --filter @fp-with-ts/docs preview"
  },
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **ステップ 2: workspace file を作成する**

`pnpm-workspace.yaml` を追加する:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **ステップ 3: base TypeScript config を作成する**

`tsconfig.base.json` を追加する:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

- [ ] **ステップ 4: ignore rule を作成する**

`.gitignore` を追加する:

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
tmp/
```

- [ ] **ステップ 5: README をイベント向けセットアップに差し替える**

`README.md` を更新する:

````markdown
# fp-with-ts-hands-on

関数型ドメインモデリングハンズオン with TypeScript の example とドキュメントサイトです。

## セットアップ

```bash
pnpm install
pnpm test
pnpm dev
```

`pnpm dev` のあと、表示された localhost URL を開いてください。

## 当日の流れ

1. 壊れやすい動物病院アプリを読む
2. 事故テストを赤くして不変条件を確認する
3. Discriminated Union で状態遷移を閉じる
4. Zod と Branded Type で境界と ID を守る
5. Result 型でエラー処理を整理する
6. AI エージェントに同じ変更を頼む前提でレビューする
````

- [ ] **ステップ 6: 依存関係をインストールする**

実行: `pnpm install`

期待結果: lockfile が作成され、install が成功する。

- [ ] **ステップ 7: コミット**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore README.md pnpm-lock.yaml
git commit -m "chore: scaffold hands-on workspace"
```

### タスク 2: 動物病院 example の壊れやすいベースライン

**ファイル:**
- 作成: `packages/clinic-example/package.json`
- 作成: `packages/clinic-example/tsconfig.json`
- 作成: `packages/clinic-example/vitest.config.ts`
- 作成: `packages/clinic-example/src/legacy/appointment.ts`
- 作成: `packages/clinic-example/src/legacy/logger.ts`
- 作成: `packages/clinic-example/test/00-setup.test.ts`
- 作成: `packages/clinic-example/exercises/00-incident.test.ts`
- 作成: `packages/clinic-example/README.md`

**インターフェース:**
- 提供: `bookAppointment(input: BookAppointmentInput): LegacyAppointment`
- 提供: `updateStatus(id: string, newStatus: string, extra?: LegacyStatusExtra): LegacyAppointment`
- 提供: `resetLegacyStore(): void`

- [ ] **ステップ 1: package metadata を作成する**

`packages/clinic-example/package.json` を追加する:

```json
{
  "name": "@fp-with-ts/clinic-example",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run \"test/**/*.test.ts\"",
    "test:watch": "vitest \"test/**/*.test.ts\"",
    "exercise:00": "vitest run exercises/00-incident.test.ts",
    "exercise:01": "vitest run exercises/01-state-modeling.test.ts",
    "exercise:02": "vitest run exercises/02-boundary-and-ids.test.ts",
    "exercise:03": "vitest run exercises/03-result-errors.test.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **ステップ 2: TypeScript config を作成する**

`packages/clinic-example/tsconfig.json` を追加する:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals"],
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "exercises/**/*.ts"]
}
```

- [ ] **ステップ 3: Vitest config を作成する**

`packages/clinic-example/vitest.config.ts` を追加する:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **ステップ 4: legacy logger を追加する**

`packages/clinic-example/src/legacy/logger.ts` を追加する:

```ts
export const logger = {
  info: (message: string, payload?: unknown): void => {
    if (payload === undefined) {
      console.log(`[INFO] ${message}`);
      return;
    }
    console.log(`[INFO] ${message}`, JSON.stringify(payload));
  },
} as const;
```

- [ ] **ステップ 5: 壊れやすい legacy appointment 実装を追加する**

`packages/clinic-example/src/legacy/appointment.ts` を追加する。`status: string` と各状態に必要な optional field をすべて含む、単一の `LegacyAppointment` type として実装する。`bookAppointment`、`updateStatus`、`resetLegacyStore` は in-memory `Map` で実装する。

`updateStatus` 実装では、`veterinarianId` が渡されたときに `paid -> in-examination` を意図的に許可する。参加者はこの事故を観察する。

- [ ] **ステップ 6: 緑のセットアップテストを追加する**

`packages/clinic-example/test/00-setup.test.ts` を追加する:

```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  bookAppointment,
  resetLegacyStore,
  updateStatus,
} from "../src/legacy/appointment.js";

const sampleInput = {
  id: "appt_001",
  petId: "pet_001",
  petName: "Mugi",
  ownerId: "owner_001",
  ownerName: "Owner A",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
};

describe("setup", () => {
  beforeEach(() => resetLegacyStore());

  test("予約から会計までの通常フローは動く", () => {
    const created = bookAppointment(sampleInput);
    updateStatus(created.id, "checked-in");
    updateStatus(created.id, "in-examination", { veterinarianId: "vet_001" });
    const paid = updateStatus(created.id, "paid", {
      diagnosis: "dermatitis",
      treatment: "ointment",
      amount: 4800,
    });

    expect(paid.status).toBe("paid");
    expect(paid.amount).toBe(4800);
  });
});
```

- [ ] **ステップ 7: 赤くなる事故 exercise を追加する**

`packages/clinic-example/exercises/00-incident.test.ts` を追加する。このテストはハンズオン開始時点で意図的に失敗する:

```ts
import { beforeEach, describe, expect, test } from "vitest";
import {
  bookAppointment,
  resetLegacyStore,
  updateStatus,
} from "../src/legacy/appointment.js";

const sampleInput = {
  id: "appt_001",
  petId: "pet_001",
  petName: "Mugi",
  ownerId: "owner_001",
  ownerName: "Owner A",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
};

describe("00 事故を起こす", () => {
  beforeEach(() => resetLegacyStore());

  test("会計済みの来院は診察中に戻せないはず", () => {
    const created = bookAppointment(sampleInput);
    updateStatus(created.id, "checked-in");
    updateStatus(created.id, "in-examination", { veterinarianId: "vet_001" });
    updateStatus(created.id, "paid", {
      diagnosis: "dermatitis",
      treatment: "ointment",
      amount: 4800,
    });

    const reverted = updateStatus(created.id, "in-examination", {
      veterinarianId: "vet_002",
    });

    expect(reverted.status).toBe("paid");
  });
});
```

module 開始時の期待結果: legacy `updateStatus` が `paid -> in-examination` を許してしまうため失敗する。

- [ ] **ステップ 8: package README を追加する**

`packages/clinic-example/README.md` を追加し、module の一覧と command を載せる:

````markdown
# clinic-example

動物病院の予約・カルテ管理システムを題材にしたハンズオン example です。

```bash
pnpm --filter @fp-with-ts/clinic-example test
pnpm --filter @fp-with-ts/clinic-example exercise:00
pnpm --filter @fp-with-ts/clinic-example typecheck
```
````

- [ ] **ステップ 9: 検証**

実行: `pnpm --filter @fp-with-ts/clinic-example test`

期待結果: 成功する。セットアップ確認は緑のままにする。

実行: `pnpm --filter @fp-with-ts/clinic-example exercise:00`

期待結果: `expected 'in-examination' to be 'paid'` で失敗する。参加者はこの事故を起点に調査する。

- [ ] **ステップ 10: コミット**

```bash
git add packages/clinic-example
git commit -m "feat(example): add fragile clinic baseline"
```

### タスク 3: 状態モデリング module

**ファイル:**
- 作成: `packages/clinic-example/src/shared/assert-never.ts`
- 作成: `packages/clinic-example/src/clinic/appointment.ts`
- 作成: `packages/clinic-example/test/01-state-modeling.test.ts`

**インターフェース:**
- 提供: `type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled`
- 提供: `const Appointment.book`, `checkIn`, `startExamination`, `recordPayment`, `cancel`, `isTerminal`

- [ ] **ステップ 1: assertNever を追加する**

`packages/clinic-example/src/shared/assert-never.ts` を追加する:

```ts
export const assertNever = (value: never): never => {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
};
```

- [ ] **ステップ 2: Appointment union と companion を追加する**

`packages/clinic-example/src/clinic/appointment.ts` を追加する。`kind` を discriminant として使い、`Scheduled`、`CheckedIn`、`InExamination`、`Paid`、`Canceled`、`Appointment`、`RecordPaymentInput`、`Appointment` companion object を定義する。

companion object は pure function だけを持つ。すべての関数は呼び出し側から `now: string` を受け取る。参加者向け exercise では `Appointment.checkIn` と `Appointment.startExamination` だけを空欄にし、`recordPayment` と `cancel` は worked example として提供する。

- [ ] **ステップ 3: runtime の状態遷移テストを追加する**

`packages/clinic-example/test/01-state-modeling.test.ts` を追加し、次をテストする:

- `Scheduled -> CheckedIn`
- `CheckedIn -> InExamination`
- `InExamination -> Paid`
- `Scheduled -> Canceled`
- terminal state が `Appointment.isTerminal` で terminal と判定されること

- [ ] **ステップ 4: 型契約テストを追加する**

同じ test file に `@ts-expect-error` call を追加する:

```ts
const paid = Appointment.recordPayment(inExamination, {
  diagnosis: "dermatitis",
  treatment: "ointment",
  amount: 4800,
}, NOW);

// @ts-expect-error Paid cannot start examination again.
Appointment.startExamination(paid, "vet_001", NOW);

// @ts-expect-error Paid cannot be canceled.
Appointment.cancel(paid, "wrong", NOW);
```

- [ ] **ステップ 5: 検証**

実行: `pnpm --filter @fp-with-ts/clinic-example typecheck`

期待結果: 成功する。`@ts-expect-error` comment が実際の型エラーで消費される。docs では「期待したエラーが出ることが成功条件になる typecheck test」であると説明する。

実行: `pnpm --filter @fp-with-ts/clinic-example test`

期待結果: 成功する。

- [ ] **ステップ 6: コミット**

```bash
git add packages/clinic-example/src/shared/assert-never.ts packages/clinic-example/src/clinic/appointment.ts packages/clinic-example/test/01-state-modeling.test.ts
git commit -m "feat(example): model appointment states with discriminated unions"
```

### タスク 4: 境界と Branded ID module

**ファイル:**
- 作成: `packages/clinic-example/src/clinic/appointment-id.ts`
- 作成: `packages/clinic-example/src/clinic/pet-id.ts`
- 作成: `packages/clinic-example/src/clinic/owner-id.ts`
- 作成: `packages/clinic-example/src/clinic/veterinarian-id.ts`
- 作成: `packages/clinic-example/src/clinic/exam-result.ts`
- 作成: `packages/clinic-example/test/02-boundary-and-ids.test.ts`

**インターフェース:**
- 提供: 各 ID companion の `safeParse(raw: unknown): z.SafeParseReturnType<unknown, Id>`
- 提供: `ExamResult.safeParse(raw: unknown): z.SafeParseReturnType<unknown, ExamResult>`

- [ ] **ステップ 1: ID companion object を追加する**

各 ID file では、private brand symbol、Zod schema、schema から推論した type、`schema` と `parse` を持つ companion object を定義する。

`pet-id.ts` の例:

```ts
import { z } from "zod";

const PetIdBrand = Symbol("PetId");
const PetIdSchema = z.string().regex(/^pet_[0-9]{3}$/).brand<typeof PetIdBrand>();
export type PetId = z.infer<typeof PetIdSchema>;

export const PetId = {
  schema: PetIdSchema,
  safeParse: (raw: unknown) => PetIdSchema.safeParse(raw),
} as const;
```

prefix は `appt_`, `pet_`, `owner_`, `vet_` を使う。

- [ ] **ステップ 2: ExamResult schema を追加する**

`packages/clinic-example/src/clinic/exam-result.ts` を追加し、次の field を持たせる:

- `examId: string`
- `petId: PetId`
- `collectedAt: string`
- `items: ReadonlyArray<{ code: string; value: number; unit: string }>`

Zod で `petId` を `PetId.schema` に通して変換する。`ExamResult.safeParse` を公開し、このタスクでは project Result type を導入しない。

- [ ] **ステップ 3: テストを追加する**

`packages/clinic-example/test/02-boundary-and-ids.test.ts` を追加する:

- valid な exam payload は `success: true` を返す
- `items` がない payload は `success: false` を返す
- `PetId` と `OwnerId` が `@ts-expect-error` で入れ替え不能になる

- [ ] **ステップ 4: 検証**

実行: `pnpm --filter @fp-with-ts/clinic-example typecheck`

期待結果: 成功する。

実行: `pnpm --filter @fp-with-ts/clinic-example test`

期待結果: 成功する。

- [ ] **ステップ 5: コミット**

```bash
git add packages/clinic-example/src/clinic/*-id.ts packages/clinic-example/src/clinic/exam-result.ts packages/clinic-example/test/02-boundary-and-ids.test.ts
git commit -m "feat(example): protect boundaries and ids with zod"
```

### タスク 5: Result とユースケース module

**ファイル:**
- 作成: `packages/clinic-example/src/shared/result.ts`
- 作成: `packages/clinic-example/src/shared/schema-result.ts`
- 作成: `packages/clinic-example/src/clinic/appointment-repository.ts`
- 作成: `packages/clinic-example/src/clinic/use-cases.ts`
- 作成: `packages/clinic-example/test/03-result-errors.test.ts`

**インターフェース:**
- 提供: `type Result<T, E>`, `ok`, `err`, `isOk`, `isErr`, `andThen`, `map`
- 提供: `schemaResult(schema): (raw: unknown) => Result<T, ValidationError>`
- 提供: `type AppointmentRepository`
- 提供: `createInMemoryAppointmentRepository(initial?: ReadonlyArray<Appointment>): AppointmentRepository`
- 提供: `startExaminationUseCase(repo, input): Result<InExamination, StartExaminationError>`

- [ ] **ステップ 1: 軽量な Result を追加する**

`packages/clinic-example/src/shared/result.ts` を追加する:

```ts
export type Ok<T> = Readonly<{ kind: "Ok"; value: T }>;
export type Err<E> = Readonly<{ kind: "Err"; error: E }>;
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ kind: "Ok", value });
export const err = <E>(error: E): Err<E> => ({ kind: "Err", error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
  result.kind === "Ok";

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> =>
  result.kind === "Err";

export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> => (isOk(result) ? ok(fn(result.value)) : result);

export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (isOk(result) ? fn(result.value) : result);
```

- [ ] **ステップ 2: schemaResult helper を追加する**

`packages/clinic-example/src/shared/schema-result.ts` を追加する:

```ts
import type { z } from "zod";
import { err, ok, type Result } from "./result.js";

export type ValidationError = Readonly<{
  kind: "ValidationError";
  issues: ReadonlyArray<z.ZodIssue>;
}>;

export const schemaResult =
  <T>(schema: z.ZodType<T>) =>
  (raw: unknown): Result<T, ValidationError> => {
    const result = schema.safeParse(raw);
    if (result.success) return ok(result.data);
    return err({ kind: "ValidationError", issues: result.error.issues });
  };
```

- [ ] **ステップ 3: repository を追加する**

`packages/clinic-example/src/clinic/appointment-repository.ts` を追加する:

```ts
import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointment-id.js";

export type AppointmentRepository = Readonly<{
  findById: (id: AppointmentId) => Appointment | undefined;
  save: (appointment: Appointment) => void;
}>;

export const createInMemoryAppointmentRepository = (
  initial: ReadonlyArray<Appointment> = [],
): AppointmentRepository => {
  const store = new Map(initial.map((appointment) => [appointment.id, appointment]));
  return {
    findById: (id) => store.get(id),
    save: (appointment) => {
      store.set(appointment.id, appointment);
    },
  };
};
```

- [ ] **ステップ 4: use case error と guard を追加する**

`packages/clinic-example/src/clinic/use-cases.ts` を追加し、次を定義する:

```ts
export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  expected: "CheckedIn";
  actual: Appointment["kind"];
}>;

export type StartExaminationError =
  | AppointmentNotFound
  | InvalidAppointmentState
  | ValidationError;
```

続けて次を実装する:

- `ensureFound`
- `ensureCheckedIn`
- `startExaminationUseCase`

use case は `appointmentId` と `veterinarianId` を parse し、appointment を lookup し、`CheckedIn` であることを guard し、`Appointment.startExamination` を呼んで保存し、`Ok` を返す。

- [ ] **ステップ 5: Result のテストを追加する**

`packages/clinic-example/test/03-result-errors.test.ts` を追加する:

- valid な checked-in appointment は `Ok` を返す
- unknown appointment id は `AppointmentNotFound` を返す
- scheduled appointment は `InvalidAppointmentState` を返す
- invalid な id shape は `ValidationError` を返す

- [ ] **ステップ 6: 検証**

実行: `pnpm --filter @fp-with-ts/clinic-example typecheck`

期待結果: 成功する。

実行: `pnpm --filter @fp-with-ts/clinic-example test`

期待結果: 成功する。

- [ ] **ステップ 7: コミット**

```bash
git add packages/clinic-example/src/shared/result.ts packages/clinic-example/src/shared/schema-result.ts packages/clinic-example/src/clinic/appointment-repository.ts packages/clinic-example/src/clinic/use-cases.ts packages/clinic-example/test/03-result-errors.test.ts
git commit -m "feat(example): compose appointment use cases with result"
```

### タスク 6: docs app の雛形作成

**ファイル:**
- 作成: `apps/docs/package.json`
- 作成: `apps/docs/tsconfig.json`
- 作成: `apps/docs/vite.config.ts`
- 作成: `apps/docs/index.html`
- 作成: `apps/docs/src/main.ts`
- 作成: `apps/docs/src/content/modules.ts`
- 作成: `apps/docs/src/styles/base.css`

**インターフェース:**
- 提供: `type ModuleContent`
- 提供: `#/`, `#/modules/00-read-broken-app` などの hash path を使う docs app route

- [ ] **ステップ 1: docs package metadata を作成する**

`apps/docs/package.json` を追加する:

```json
{
  "name": "@fp-with-ts/docs",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "@vitejs/plugin-legacy": "^5.4.0",
    "vite": "^5.4.0"
  },
  "devDependencies": {}
}
```

- [ ] **ステップ 2: docs tsconfig を作成する**

`apps/docs/tsconfig.json` を追加する:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "vite.config.ts"]
}
```

- [ ] **ステップ 3: Vite config と HTML shell を作成する**

`apps/docs/vite.config.ts` を追加する:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

`apps/docs/index.html` を追加し、`<div id="app"></div>` と module script `/src/main.ts` を置く。

- [ ] **ステップ 4: content data を追加する**

`apps/docs/src/content/modules.ts` を追加し、改訂後のイベントフローに合う 7 つの time block を定義する:

- `00-break-the-app`
- `00-read-the-incident`
- `01-state-modeling`
- `02-boundary-and-ids`
- `03-result-errors`
- `04-agent-review`
- `05-mini-integration`

各 module は `animal`, `minutes`, `title`, `incident`, `invariant`, `redCommand`, `editTarget`, `greenCommand`, `agentReview`, `doneWhen`, `sections` を持つ。

- [ ] **ステップ 5: base renderer を追加する**

`apps/docs/src/main.ts` を追加し、次を render する:

- app header
- sidebar の module list
- `location.hash` に基づく current module content
- `Paid -> InExamination` を示す常時表示の incident summary
- current phase indicator: `インシデント`, `赤テスト`, `編集`, `緑テスト`, `エージェントレビュー`
- previous/next navigation

DOM API を使い、framework dependency は増やさない。

- [ ] **ステップ 6: base CSS を追加する**

`apps/docs/src/styles/base.css` を追加し、responsive layout を定義する:

- desktop: sidebar + main content
- mobile: top module nav
- code block: horizontal scroll
- animal marker icon: text または CSS background

- [ ] **ステップ 7: 検証**

実行: `pnpm --filter @fp-with-ts/docs build`

期待結果: Vite build が成功し、`apps/docs/dist` が出力される。

- [ ] **ステップ 8: コミット**

```bash
git add apps/docs
git commit -m "feat(docs): scaffold animal clinic guide"
```

### タスク 7: 動物病院らしいドキュメント UI の仕上げ

**ファイル:**
- 変更: `apps/docs/src/content/modules.ts`
- 変更: `apps/docs/src/main.ts`
- 変更: `apps/docs/src/styles/base.css`
- 作成: `apps/docs/src/components/code-block.ts`
- 作成: `apps/docs/src/components/module-card.ts`

**インターフェース:**
- 提供: 再利用可能な `renderCodeBlock(code: string, language: string): HTMLElement`
- 提供: 再利用可能な `renderModuleCard(module: ModuleContent): HTMLElement`

- [ ] **ステップ 1: code block renderer を切り出す**

`apps/docs/src/components/code-block.ts` を追加する:

```ts
export const renderCodeBlock = (code: string, language: string): HTMLElement => {
  const figure = document.createElement("figure");
  figure.className = "code-block";

  const caption = document.createElement("figcaption");
  caption.textContent = language;

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.textContent = code;
  pre.append(codeElement);

  figure.append(caption, pre);
  return figure;
};
```

- [ ] **ステップ 2: module card renderer を切り出す**

`apps/docs/src/components/module-card.ts` を追加し、animal marker、title、minutes、goal を render する。

- [ ] **ステップ 3: module content を埋める**

`modules.ts` を更新し、各 module が参加者向けの固定フローを持つようにする:

- `インシデント`: 動物病院で何が起きたか
- `赤テスト`: 実行する exact command と期待する失敗
- `編集`: 参加者が編集する 1〜2 個の関数
- `緑テスト`: 再実行する exact command と期待する成功
- `エージェントレビュー`: AI-assisted development を想定した prompt または review checklist
- `完了条件`: 参加者向けの完了条件を 1 つ

- [ ] **ステップ 4: CSS を仕上げる**

`base.css` を更新する:

- card は `border-radius: 8px` に収める
- palette は white, mint, pale yellow, teal, red accent をバランスよく使う
- sidebar width を安定させる
- code block が layout を押し広げないようにする
- mobile navigation が overlap せず wrap するようにする
- animal marker は装飾だけでなく、state や incident の手がかりとして使う
- first viewport に current incident、invariant、next command が見えるようにする

- [ ] **ステップ 5: 見た目を確認する**

dev server を起動する:

```bash
pnpm --filter @fp-with-ts/docs dev
```

local URL を開き、desktop と mobile width を確認する。Playwright が使える場合は 1440x900 と 390x844 の screenshot を撮る。

- [ ] **ステップ 6: build を確認する**

実行: `pnpm --filter @fp-with-ts/docs build`

期待結果: 成功する。

- [ ] **ステップ 7: コミット**

```bash
git add apps/docs/src
git commit -m "feat(docs): polish animal clinic learning guide"
```

### タスク 8: Cloudflare Worker Static Assets 配信

**ファイル:**
- 作成: `wrangler.jsonc`
- 作成: `worker/index.ts`
- 作成: `worker/tsconfig.json`
- 変更: `package.json`

**インターフェース:**
- 提供: Worker env type `{ ASSETS: Fetcher }`
- 提供: `/healthz` endpoint returning `ok`

- [ ] **ステップ 1: Wrangler dev dependency を追加する**

root `package.json` の devDependencies を更新する:

```json
"wrangler": "^4.20.0",
"@cloudflare/workers-types": "^4.20260804.0"
```

script を追加する:

```json
"cf:dev": "pnpm build && wrangler dev",
"cf:deploy": "pnpm build && wrangler deploy"
```

- [ ] **ステップ 2: Wrangler config を追加する**

`wrangler.jsonc` を追加する:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "fp-with-ts-hands-on",
  "main": "worker/index.ts",
  "compatibility_date": "2026-08-04",
  "assets": {
    "directory": "apps/docs/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  }
}
```

- [ ] **ステップ 3: worker tsconfig を追加する**

`worker/tsconfig.json` を追加する:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **ステップ 4: Worker entrypoint を追加する**

`worker/index.ts` を追加する:

```ts
export type Env = Readonly<{
  ASSETS: Fetcher;
}>;

export default {
  fetch: (request: Request, env: Env): Response | Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") {
      return new Response("ok", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **ステップ 5: インストールして確認する**

実行: `pnpm install`

実行: `pnpm build`

実行: `pnpm exec wrangler dev`

期待結果: local Worker が docs を配信し、`/healthz` が `ok` を返す。

- [ ] **ステップ 6: コミット**

```bash
git add package.json pnpm-lock.yaml wrangler.jsonc worker
git commit -m "feat(worker): serve docs with cloudflare static assets"
```

### タスク 9: イベント当日用ドキュメント

**ファイル:**
- 変更: `README.md`
- 作成: `docs/event/facilitator-guide.md`
- 作成: `docs/event/participant-setup.md`
- 作成: `docs/event/troubleshooting.md`

**インターフェース:**
- 提供: connpass と opening から参照できる participant setup path
- 提供: 3 時間の timetable に揃えた facilitator guide

- [ ] **ステップ 1: participant setup を追加する**

`docs/event/participant-setup.md` を追加する:

````markdown
# 参加者向けセットアップ

## 必要なもの

- Node.js 20 以上
- pnpm
- Git
- 普段使っているエディタ

## 確認コマンド

```bash
node --version
pnpm --version
git --version
```

## 当日のリポジトリ確認

```bash
git clone https://github.com/iwasa-kosui/fp-with-ts-hands-on.git
cd fp-with-ts-hands-on
pnpm install
pnpm test
pnpm dev
```
````

- [ ] **ステップ 2: facilitator guide を追加する**

`docs/event/facilitator-guide.md` を追加し、イベントの正確な timetable と module mapping を載せる。checkpoint は 0:30, 1:10, 1:55, 2:30 に置く。

- [ ] **ステップ 3: troubleshooting を追加する**

`docs/event/troubleshooting.md` を追加し、次の対処方法を載せる:

- `pnpm: command not found`
- Node.js version too old
- install fails
- tests fail before edits
- port already in use

- [ ] **ステップ 4: README から docs へリンクする**

`README.md` を更新し、participant setup、facilitator guide、troubleshooting へリンクする。

- [ ] **ステップ 5: docs path を確認する**

実行: `rg -n "participant-setup|facilitator-guide|troubleshooting" README.md docs/event`

期待結果: link と heading が存在する。

- [ ] **ステップ 6: コミット**

```bash
git add README.md docs/event
git commit -m "docs(event): add setup and facilitator guides"
```

### タスク 10: 最終検証

**ファイル:**
- 変更: failing command または visual QA finding が示した file だけ

**インターフェース:**
- 利用: ここまでのすべての task
- 提供: deployable な site と runnable な example

- [ ] **ステップ 1: typecheck を実行する**

実行: `pnpm typecheck`

期待結果: 成功する。

- [ ] **ステップ 2: test を実行する**

実行: `pnpm test`

期待結果: 成功する。

- [ ] **ステップ 3: build を実行する**

実行: `pnpm build`

期待結果: 成功し、`apps/docs/dist` が存在する。

- [ ] **ステップ 4: Worker をローカルで起動する**

実行: `pnpm exec wrangler dev`

期待結果: docs site が読み込まれ、`/healthz` が `ok` を返す。

- [ ] **ステップ 5: Visual QA を行う**

確認項目:

- desktop 1440px: sidebar と content が overlap しない
- mobile 390px: module nav が clean に wrap する
- code block が横スクロールできる
- animal marker が render される
- すべての module link が navigate する

- [ ] **ステップ 6: 検証で見つかった問題を直す**

各 issue には最小範囲の修正を入れ、失敗した command を再実行する。

- [ ] **ステップ 7: 修正をコミットする**

```bash
git add .
git commit -m "fix: address event readiness verification"
```

修正不要だった場合、このコミットは省略する。
