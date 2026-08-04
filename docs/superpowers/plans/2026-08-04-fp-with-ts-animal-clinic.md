# 関数型ドメインモデリングハンズオン with TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-08-30 のハンズオンイベントで使う、動物病院 example と Cloudflare Workers 配信のかわいいドキュメントサイトを構築する。

**Architecture:** pnpm workspace に `apps/docs` と `packages/clinic-example` を同居させる。docs は Vite が静的 assets を生成し、Worker は `/healthz` 以外を `ASSETS.fetch` に委譲する。example は DB なしの TypeScript + Vitest で、状態遷移、Zod + Branded Type、Result 型を小さな exercise として実装する。

**Tech Stack:** pnpm, TypeScript, Vite, Vitest, Zod, Cloudflare Workers Static Assets, Wrangler

## Global Constraints

- 対象者は TypeScript 初級から中級。基本文法が書ける前提で、複雑な型テクニックは避ける。
- 当日準備は Node.js、pnpm、GitHub clone のみ。DB、Docker、外部 API key は要求しない。
- ドキュメント生成ツールは使わない。docs は Vite + TypeScript + 手書き content module で実装する。
- Cloudflare Workers で配信する。`assets.directory` は `apps/docs/dist` にする。
- ドメイン型は `type`、`kind` discriminant、Readonly、Companion Object、関数プロパティ記法を使う。
- `as` は原則禁止。Zod brand または `@ts-expect-error` の型テスト目的以外では使わない。
- UI は動物病院らしいかわいさを持たせるが、教材本文とコードの可読性を最優先する。

---

### Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: root scripts `dev`, `build`, `test`, `typecheck`, `preview`
- Produces: workspace package names `@fp-with-ts/docs` and `@fp-with-ts/clinic-example`

- [ ] **Step 1: Create root package metadata**

Add `package.json`:

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

- [ ] **Step 2: Create workspace file**

Add `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create base TypeScript config**

Add `tsconfig.base.json`:

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

- [ ] **Step 4: Create ignore rules**

Add `.gitignore`:

```gitignore
node_modules/
dist/
.wrangler/
.dev.vars
tmp/
```

- [ ] **Step 5: Replace README with event setup**

Update `README.md`:

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
2. Discriminated Union で状態遷移を型にする
3. Zod と Branded Type で境界と ID を守る
4. Result 型でエラー処理を整理する
5. AI エージェント時代の設計原則を確認する
````

- [ ] **Step 6: Install dependencies**

Run: `pnpm install`

Expected: lockfile is created and install succeeds.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore README.md pnpm-lock.yaml
git commit -m "chore: scaffold hands-on workspace"
```

### Task 2: Clinic Example Baseline

**Files:**
- Create: `packages/clinic-example/package.json`
- Create: `packages/clinic-example/tsconfig.json`
- Create: `packages/clinic-example/vitest.config.ts`
- Create: `packages/clinic-example/src/legacy/appointment.ts`
- Create: `packages/clinic-example/src/legacy/logger.ts`
- Create: `packages/clinic-example/test/00-broken-app.test.ts`
- Create: `packages/clinic-example/README.md`

**Interfaces:**
- Produces: `bookAppointment(input: BookAppointmentInput): LegacyAppointment`
- Produces: `updateStatus(id: string, newStatus: string, extra?: LegacyStatusExtra): LegacyAppointment`
- Produces: `resetLegacyStore(): void`

- [ ] **Step 1: Create package metadata**

Add `packages/clinic-example/package.json`:

```json
{
  "name": "@fp-with-ts/clinic-example",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
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

- [ ] **Step 2: Create TypeScript config**

Add `packages/clinic-example/tsconfig.json`:

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

- [ ] **Step 3: Create Vitest config**

Add `packages/clinic-example/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

- [ ] **Step 4: Add legacy logger**

Add `packages/clinic-example/src/legacy/logger.ts`:

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

- [ ] **Step 5: Add fragile legacy appointment implementation**

Add `packages/clinic-example/src/legacy/appointment.ts` with a single `LegacyAppointment` type containing `status: string` and optional fields for every state. Implement `bookAppointment`, `updateStatus`, and `resetLegacyStore` using an in-memory `Map`.

The `updateStatus` implementation must intentionally allow `paid -> in-examination` when `veterinarianId` is supplied. This is the incident participants will observe.

- [ ] **Step 6: Add failing-then-passing incident tests**

Add `packages/clinic-example/test/00-broken-app.test.ts`:

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
  ownerName: "Sato",
  ownerPhone: "090-0000-0000",
  ownerEmail: "sato@example.test",
  scheduledAt: "2026-08-30T06:30:00.000Z",
  reason: "skin check",
};

describe("00 壊れやすい動物病院アプリ", () => {
  beforeEach(() => resetLegacyStore());

  test("会計済みから診察中へ戻れてしまう", () => {
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

    expect(reverted.status).toBe("in-examination");
    expect(reverted.veterinarianId).toBe("vet_002");
    expect(reverted.diagnosis).toBe("dermatitis");
  });
});
```

- [ ] **Step 7: Add package README**

Add `packages/clinic-example/README.md` with module list and commands:

````markdown
# clinic-example

動物病院の予約・カルテ管理システムを題材にしたハンズオン example です。

```bash
pnpm --filter @fp-with-ts/clinic-example test
pnpm --filter @fp-with-ts/clinic-example typecheck
```
````

- [ ] **Step 8: Verify**

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: `00-broken-app.test.ts` passes and demonstrates the bug.

- [ ] **Step 9: Commit**

```bash
git add packages/clinic-example
git commit -m "feat(example): add fragile clinic baseline"
```

### Task 3: State Modeling Module

**Files:**
- Create: `packages/clinic-example/src/shared/assert-never.ts`
- Create: `packages/clinic-example/src/clinic/appointment.ts`
- Create: `packages/clinic-example/test/01-state-modeling.test.ts`

**Interfaces:**
- Produces: `type Appointment = Scheduled | CheckedIn | InExamination | Paid | Canceled`
- Produces: `const Appointment.book`, `checkIn`, `startExamination`, `recordPayment`, `cancel`, `isTerminal`

- [ ] **Step 1: Add assertNever**

Add `packages/clinic-example/src/shared/assert-never.ts`:

```ts
export const assertNever = (value: never): never => {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
};
```

- [ ] **Step 2: Add Appointment union and companion**

Add `packages/clinic-example/src/clinic/appointment.ts`. Use `kind` as the discriminant. Define `Scheduled`, `CheckedIn`, `InExamination`, `Paid`, `Canceled`, `Appointment`, `RecordPaymentInput`, and `Appointment` companion object.

The companion object must include pure functions only. Every function receives `now: string` from the caller.

- [ ] **Step 3: Add runtime transition tests**

Add `packages/clinic-example/test/01-state-modeling.test.ts` tests for:

- `Scheduled -> CheckedIn`
- `CheckedIn -> InExamination`
- `InExamination -> Paid`
- `Scheduled -> Canceled`
- terminal states are terminal via `Appointment.isTerminal`

- [ ] **Step 4: Add type contract tests**

In the same test file, add `@ts-expect-error` calls:

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

- [ ] **Step 5: Verify**

Run: `pnpm --filter @fp-with-ts/clinic-example typecheck`

Expected: PASS. The `@ts-expect-error` comments are consumed by real type errors.

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/clinic-example/src/shared/assert-never.ts packages/clinic-example/src/clinic/appointment.ts packages/clinic-example/test/01-state-modeling.test.ts
git commit -m "feat(example): model appointment states with discriminated unions"
```

### Task 4: Boundary And Branded ID Module

**Files:**
- Create: `packages/clinic-example/src/shared/result.ts`
- Create: `packages/clinic-example/src/shared/schema-result.ts`
- Create: `packages/clinic-example/src/clinic/appointment-id.ts`
- Create: `packages/clinic-example/src/clinic/pet-id.ts`
- Create: `packages/clinic-example/src/clinic/owner-id.ts`
- Create: `packages/clinic-example/src/clinic/veterinarian-id.ts`
- Create: `packages/clinic-example/src/clinic/exam-result.ts`
- Create: `packages/clinic-example/test/02-boundary-and-ids.test.ts`

**Interfaces:**
- Produces: `type Result<T, E>`, `ok`, `err`, `isOk`, `isErr`, `andThen`, `map`
- Produces: each ID companion `parse(raw: unknown): Result<Id, ValidationError>`
- Produces: `ExamResult.parse(raw: unknown): Result<ExamResult, ValidationError>`

- [ ] **Step 1: Add lightweight Result**

Add `packages/clinic-example/src/shared/result.ts`:

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

- [ ] **Step 2: Add schemaResult helper**

Add `packages/clinic-example/src/shared/schema-result.ts`:

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

- [ ] **Step 3: Add ID companion objects**

For each ID file, define a private brand symbol, a Zod schema, a type inferred from the schema, and a companion object with `schema` and `parse`.

Example for `pet-id.ts`:

```ts
import { z } from "zod";
import { schemaResult } from "../shared/schema-result.js";

const PetIdBrand = Symbol("PetId");
const PetIdSchema = z.string().regex(/^pet_[0-9]{3}$/).brand<typeof PetIdBrand>();
export type PetId = z.infer<typeof PetIdSchema>;

export const PetId = {
  schema: PetIdSchema,
  parse: schemaResult(PetIdSchema),
} as const;
```

Use prefixes `appt_`, `pet_`, `owner_`, `vet_`.

- [ ] **Step 4: Add ExamResult schema**

Add `packages/clinic-example/src/clinic/exam-result.ts` with fields:

- `examId: string`
- `petId: PetId`
- `collectedAt: string`
- `items: ReadonlyArray<{ code: string; value: number; unit: string }>`

Use Zod to transform `petId` through `PetId.schema`.

- [ ] **Step 5: Add tests**

Add `packages/clinic-example/test/02-boundary-and-ids.test.ts`:

- valid exam payload returns `Ok`
- missing `items` returns `Err` with `ValidationError`
- `PetId` and `OwnerId` are not interchangeable with `@ts-expect-error`

- [ ] **Step 6: Verify**

Run: `pnpm --filter @fp-with-ts/clinic-example typecheck`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/clinic-example/src/shared packages/clinic-example/src/clinic/*-id.ts packages/clinic-example/src/clinic/exam-result.ts packages/clinic-example/test/02-boundary-and-ids.test.ts
git commit -m "feat(example): protect boundaries and ids with zod"
```

### Task 5: Result Use Case Module

**Files:**
- Create: `packages/clinic-example/src/clinic/appointment-repository.ts`
- Create: `packages/clinic-example/src/clinic/use-cases.ts`
- Create: `packages/clinic-example/test/03-result-errors.test.ts`

**Interfaces:**
- Produces: `type AppointmentRepository`
- Produces: `createInMemoryAppointmentRepository(initial?: ReadonlyArray<Appointment>): AppointmentRepository`
- Produces: `startExaminationUseCase(repo, input): Result<InExamination, StartExaminationError>`

- [ ] **Step 1: Add repository**

Add `packages/clinic-example/src/clinic/appointment-repository.ts`:

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

- [ ] **Step 2: Add use case errors and guards**

Add `packages/clinic-example/src/clinic/use-cases.ts` with:

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

Then implement:

- `ensureFound`
- `ensureCheckedIn`
- `startExaminationUseCase`

The use case parses `appointmentId` and `veterinarianId`, looks up the appointment, guards `CheckedIn`, calls `Appointment.startExamination`, saves it, and returns `Ok`.

- [ ] **Step 3: Add Result tests**

Add `packages/clinic-example/test/03-result-errors.test.ts`:

- valid checked-in appointment returns `Ok`
- unknown appointment id returns `AppointmentNotFound`
- scheduled appointment returns `InvalidAppointmentState`
- invalid id shape returns `ValidationError`

- [ ] **Step 4: Verify**

Run: `pnpm --filter @fp-with-ts/clinic-example typecheck`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-example test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/clinic-example/src/clinic/appointment-repository.ts packages/clinic-example/src/clinic/use-cases.ts packages/clinic-example/test/03-result-errors.test.ts
git commit -m "feat(example): compose appointment use cases with result"
```

### Task 6: Docs App Scaffold

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/tsconfig.json`
- Create: `apps/docs/vite.config.ts`
- Create: `apps/docs/index.html`
- Create: `apps/docs/src/main.ts`
- Create: `apps/docs/src/content/modules.ts`
- Create: `apps/docs/src/styles/base.css`

**Interfaces:**
- Produces: `type ModuleContent`
- Produces: docs app routes using hash paths: `#/`, `#/modules/00-read-broken-app`, etc.

- [ ] **Step 1: Create docs package metadata**

Add `apps/docs/package.json`:

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

- [ ] **Step 2: Create docs tsconfig**

Add `apps/docs/tsconfig.json`:

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

- [ ] **Step 3: Create Vite config and HTML shell**

Add `apps/docs/vite.config.ts`:

```ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

Add `apps/docs/index.html` with `<div id="app"></div>` and module script `/src/main.ts`.

- [ ] **Step 4: Add content data**

Add `apps/docs/src/content/modules.ts` with 5 modules matching the event timetable:

- `00-read-broken-app`
- `01-state-modeling`
- `02-boundary-and-ids`
- `03-result-errors`
- `04-agent-principles`

Each module includes `animal`, `minutes`, `title`, `incident`, `goal`, `commands`, and `sections`.

- [ ] **Step 5: Add base renderer**

Add `apps/docs/src/main.ts` that renders:

- app header
- sidebar module list
- current module content based on `location.hash`
- previous/next navigation

Use DOM APIs and avoid framework dependencies.

- [ ] **Step 6: Add base CSS**

Add `apps/docs/src/styles/base.css` with responsive layout:

- desktop: sidebar + main content
- mobile: top module nav
- code blocks: horizontal scroll
- animal marker icons as text or CSS background

- [ ] **Step 7: Verify**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: Vite build succeeds and writes `apps/docs/dist`.

- [ ] **Step 8: Commit**

```bash
git add apps/docs
git commit -m "feat(docs): scaffold animal clinic guide"
```

### Task 7: Polish Animal Clinic Documentation UI

**Files:**
- Modify: `apps/docs/src/content/modules.ts`
- Modify: `apps/docs/src/main.ts`
- Modify: `apps/docs/src/styles/base.css`
- Create: `apps/docs/src/components/code-block.ts`
- Create: `apps/docs/src/components/module-card.ts`

**Interfaces:**
- Produces: reusable `renderCodeBlock(code: string, language: string): HTMLElement`
- Produces: reusable `renderModuleCard(module: ModuleContent): HTMLElement`

- [ ] **Step 1: Extract code block renderer**

Add `apps/docs/src/components/code-block.ts`:

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

- [ ] **Step 2: Extract module card renderer**

Add `apps/docs/src/components/module-card.ts` that renders animal marker, title, minutes, and goal.

- [ ] **Step 3: Fill module content**

Update `modules.ts` so each module has:

- one incident story
- one short explanation
- one command block
- one code excerpt
- one exercise checklist

- [ ] **Step 4: Polish CSS**

Update `base.css`:

- keep cards at `border-radius: 8px`
- use a balanced palette: white, mint, pale yellow, teal, red accent
- define stable sidebar width
- ensure code blocks do not resize layout
- ensure mobile navigation wraps without overlap

- [ ] **Step 5: Verify visually**

Start dev server:

```bash
pnpm --filter @fp-with-ts/docs dev
```

Open the local URL and check desktop and mobile widths. If Playwright is available, capture screenshots at 1440x900 and 390x844.

- [ ] **Step 6: Verify build**

Run: `pnpm --filter @fp-with-ts/docs build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/docs/src
git commit -m "feat(docs): polish animal clinic learning guide"
```

### Task 8: Cloudflare Worker Static Assets

**Files:**
- Create: `wrangler.jsonc`
- Create: `worker/index.ts`
- Create: `worker/tsconfig.json`
- Modify: `package.json`

**Interfaces:**
- Produces: Worker env type `{ ASSETS: Fetcher }`
- Produces: `/healthz` endpoint returning `ok`

- [ ] **Step 1: Add Wrangler dev dependency**

Update root `package.json` devDependencies:

```json
"wrangler": "^4.20.0",
"@cloudflare/workers-types": "^4.20260804.0"
```

Add scripts:

```json
"cf:dev": "pnpm build && wrangler dev",
"cf:deploy": "pnpm build && wrangler deploy"
```

- [ ] **Step 2: Add Wrangler config**

Add `wrangler.jsonc`:

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

- [ ] **Step 3: Add worker tsconfig**

Add `worker/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 4: Add Worker entrypoint**

Add `worker/index.ts`:

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

- [ ] **Step 5: Install and verify**

Run: `pnpm install`

Run: `pnpm build`

Run: `pnpm exec wrangler dev`

Expected: local Worker serves docs and `/healthz` returns `ok`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml wrangler.jsonc worker
git commit -m "feat(worker): serve docs with cloudflare static assets"
```

### Task 9: Event Readiness Documentation

**Files:**
- Modify: `README.md`
- Create: `docs/event/facilitator-guide.md`
- Create: `docs/event/participant-setup.md`
- Create: `docs/event/troubleshooting.md`

**Interfaces:**
- Produces: participant setup path for connpass and opening
- Produces: facilitator guide aligned to 3-hour timetable

- [ ] **Step 1: Add participant setup**

Add `docs/event/participant-setup.md`:

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

- [ ] **Step 2: Add facilitator guide**

Add `docs/event/facilitator-guide.md` with the exact event timetable and module mapping. Include checkpoints at 0:30, 1:10, 1:55, 2:30.

- [ ] **Step 3: Add troubleshooting**

Add `docs/event/troubleshooting.md` with fixes for:

- `pnpm: command not found`
- Node.js version too old
- install fails
- tests fail before edits
- port already in use

- [ ] **Step 4: Link docs from README**

Update `README.md` to link participant setup, facilitator guide, and troubleshooting.

- [ ] **Step 5: Verify docs paths**

Run: `rg -n "participant-setup|facilitator-guide|troubleshooting" README.md docs/event`

Expected: links and headings are present.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/event
git commit -m "docs(event): add setup and facilitator guides"
```

### Task 10: Final Verification

**Files:**
- Modify: only files reported by the failing command or visual QA finding.

**Interfaces:**
- Consumes: all prior tasks
- Produces: deployable site and runnable example

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 2: Run tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm build`

Expected: PASS and `apps/docs/dist` exists.

- [ ] **Step 4: Run Worker locally**

Run: `pnpm exec wrangler dev`

Expected: docs site loads, `/healthz` returns `ok`.

- [ ] **Step 5: Visual QA**

Check:

- desktop 1440px: sidebar and content do not overlap
- mobile 390px: module nav wraps cleanly
- code blocks horizontally scroll
- animal markers render
- all module links navigate

- [ ] **Step 6: Fix any verification issues**

For each issue, make the smallest scoped change and rerun the failing command.

- [ ] **Step 7: Commit fixes**

```bash
git add .
git commit -m "fix: address event readiness verification"
```

Skip this commit if no fixes were needed.
