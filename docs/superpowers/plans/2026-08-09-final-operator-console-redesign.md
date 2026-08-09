# `examples/final` Operator Console UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `examples/final` の全画面を、既存の業務機能・Inertia props・認可・PII 境界を維持した高密度な Operator Console UI へ統一する。

**Architecture:** 既存の各ページ component と route 契約は残し、表示専用の `AppShell`、`PageHeader`、`StatusBadge`、`DataTable`、フォーム部品を primary web adaptor に追加する。デザイン値は一つの `styles.css` の CSS custom properties に集約し、ページは既存 props を共通部品へ明示的に渡す。Superdesign 採用案からはサイドバー、トップバー、密なカード・表の視覚構造だけを使い、生成案が追加した検索、通知、在庫、架空データは使わない。

**Tech Stack:** React 19、Inertia React 3、Hono、TypeScript、CSS custom properties、Vitest、React SSR

## Global Constraints

- Hono route、Inertia props、use case、認証・認可、domain state、SQLite 永続化形式を変更しない。
- CSS framework、UI component library、外部 icon package、Google Fonts などの外部 runtime asset を追加しない。
- 色は `#F4F7FB`、`#FFFFFF`、`#F8FAFC`、`#EEF2FF`、`#E2E8F0`、`#CBD5E1`、`#0F172A`、`#64748B`、`#4F46E5`、`#0F766E`、`#B45309`、`#B91C1C`、`#0369A1` と、それぞれ仕様書で定義した soft color だけを使う。
- 文字は `Inter, "Noto Sans JP", ui-sans-serif, system-ui, sans-serif` とし、外部 font download を要求しない。
- 既存の server-projected action flags を操作可否の唯一の情報源とし、UI で domain rule や permission を再実装しない。
- 既存の DTO にない検索、通知、在庫、来院目的、飼い主名、時刻、件数、診療自由記述を作らない。
- PII、診療自由記述、raw audit payload の既存公開境界を広げない。
- role-aware navigation、validation summary、`aria-describedby`、`aria-invalid`、destructive confirmation を維持する。
- デスクトップ `>= 1100px`、タブレット `768–1099px`、モバイル `< 768px` の三段階を CSS で扱う。
- 各 green checkpoint は独立した Conventional Commit とし、その都度 `codex/feat-final-hono-inertia-drizzle` を push する。

---

## File map

### New display components

- `examples/final/src/adaptor/primary/web/components/Icon.tsx`: allowlist された inline SVG icon を描画する。
- `examples/final/src/adaptor/primary/web/components/AppShell.tsx`: role-aware sidebar、mobile navigation、top bar、user/logout area を描画する。
- `examples/final/src/adaptor/primary/web/components/PageHeader.tsx`: title、description、actions のページ共通階層を描画する。
- `examples/final/src/adaptor/primary/web/components/StatusBadge.tsx`: semantic tone とテキストを組み合わせる。
- `examples/final/src/adaptor/primary/web/components/DataTable.tsx`: native table の overflow container と class contract を提供する。
- `examples/final/src/adaptor/primary/web/components/Surface.tsx`: `Card`、`EmptyState`、`InlineAlert` の静的 surface を提供する。
- `examples/final/src/adaptor/primary/web/components/FormField.tsx`: label、description、control、error の関係を統一する。
- `examples/final/src/adaptor/primary/web/components/Button.tsx`: button/link が共有する variant class を返す。
- `examples/final/src/adaptor/primary/web/components/appointmentPresentation.ts`: appointment kind の日本語 label、canonical label、semantic tone の純粋な mapping を提供する。

### Existing files to modify

- `examples/final/src/adaptor/primary/web/pages/Layout.tsx`: 既存 page import を保つ compatibility layer として `AppShell` と `PageHeader` を組み立てる。
- `examples/final/src/adaptor/primary/web/components/FormErrors.tsx`: Operator Console alert classes を付け、既存 ARIA contract を保つ。
- `examples/final/src/adaptor/primary/web/styles.css`: token、base、shell、component、page、responsive の全スタイルを所有する。
- `examples/final/src/adaptor/primary/web/pages/Login.tsx`
- `examples/final/src/adaptor/primary/web/pages/Setup.tsx`
- `examples/final/src/adaptor/primary/web/pages/Dashboard.tsx`
- `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Appointments/New.tsx`
- `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- `examples/final/src/adaptor/primary/web/pages/Users/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Users/Form.tsx`
- `examples/final/src/adaptor/primary/web/pages/Owners/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Owners/Form.tsx`
- `examples/final/src/adaptor/primary/web/pages/Pets/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Pets/Form.tsx`
- `examples/final/src/adaptor/primary/web/pages/FollowUps/Index.tsx`
- `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`

### Tests

- Create `examples/final/test/web/operatorConsolePages.test.tsx`: shell、role navigation、auth pages、dashboard、appointment workflow、lists、responsive class contracts を React SSR で検証する。
- Modify `examples/final/test/web/managementPages.test.tsx`: management forms/tables の新しい structure と既存 accessibility copy を併せて検証する。
- Modify `examples/final/test/web/securityBoundary.test.ts`: 新 UI でも DTO 外データと raw payload が増えないことを維持する。

---

### Task 1: Operator Console shell と視覚基盤

**Files:**
- Create: `examples/final/src/adaptor/primary/web/components/Icon.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/AppShell.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/PageHeader.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/Button.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Layout.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Create: `examples/final/test/web/operatorConsolePages.test.tsx`

**Interfaces:**
- Produces: `type NavigationKey = "dashboard" | "appointments" | "users" | "owners" | "pets" | "follow-ups" | "events"`
- Produces: `AppShell({ activeNavigation, children, title, user }: AppShellProps): ReactElement`
- Produces: `PageHeader({ actions, description, title }: PageHeaderProps): ReactElement`
- Produces: `buttonClassName(variant?: "primary" | "secondary" | "ghost" | "danger"): string`
- Produces: backward-compatible `Layout` with optional `activeNavigation`, `actions`, and `description` props.

- [ ] **Step 1: shell の失敗する SSR test を追加する**

```tsx
const adminHtml = renderToString(
  <Layout
    activeNavigation="dashboard"
    actions={<Link href="/appointments/new">新しい予約</Link>}
    description="現在の業務状況を確認します。"
    title="ダッシュボード"
    user={{ userId: adminId, role: "Admin" }}
  >
    <p>content</p>
  </Layout>,
);

expect(adminHtml).toContain('class="app-sidebar"');
expect(adminHtml).toContain('aria-current="page"');
expect(adminHtml).toContain('aria-label="メインナビゲーション"');
expect(adminHtml).toContain('href="/events"');
expect(adminHtml).toContain('href="/users"');
expect(adminHtml).toContain("新しい予約");
expect(adminHtml).not.toContain("iconify");
expect(adminHtml).not.toContain("fonts.googleapis.com");
```

- [ ] **Step 2: focused test を実行して RED を確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx`

Expected: FAIL because `LayoutProps` does not accept `activeNavigation`, `actions`, or `description`, and `.app-sidebar` is absent.

- [ ] **Step 3: allowlist icon と shell interface を実装する**

`Icon.tsx` は外部 asset を使わず、次の union と `<svg aria-hidden="true">` を実装する。

```tsx
export type IconName =
  | "activity"
  | "calendar"
  | "dashboard"
  | "events"
  | "followUp"
  | "logout"
  | "menu"
  | "owners"
  | "paw"
  | "plus"
  | "users";

export const Icon = ({ name }: Readonly<{ name: IconName }>) => (
  <svg aria-hidden="true" className="icon" focusable="false" viewBox="0 0 24 24">
    {paths[name]}
  </svg>
);
```

`AppShell.tsx` の nav item は route、label、icon、roles を固定値で宣言し、`roles.includes(user.role)` の結果だけを表示に使う。`activeNavigation` が一致した link に `aria-current="page"` を付ける。mobile menu button は `aria-controls="app-navigation"` と `aria-expanded` を持ち、React `useState(false)` だけで開閉する。

- [ ] **Step 4: Layout と基礎 CSS を実装する**

```tsx
type LayoutProps = PropsWithChildren<Readonly<{
  activeNavigation?: NavigationKey;
  actions?: ReactNode;
  description?: string;
  title: string;
  user?: AuthenticatedUserView | null;
}>>;

export default function Layout(props: LayoutProps) {
  return (
    <AppShell activeNavigation={props.activeNavigation} title={props.title} user={props.user}>
      <PageHeader actions={props.actions} description={props.description} title={props.title} />
      {props.children}
    </AppShell>
  );
}
```

`styles.css` の先頭に仕様書の custom properties、font、focus-visible、button reset を追加し、desktop の `.app-sidebar { width: 232px; }`、`.app-content`、`.top-bar`、`.page-header` を実装する。この task では page-specific selector をまだ追加しない。

- [ ] **Step 5: focused test と package typecheck を GREEN にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: shell checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/components examples/final/src/adaptor/primary/web/pages/Layout.tsx examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/operatorConsolePages.test.tsx
git commit -m "feat(final): Operator Consoleのアプリシェルを追加"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 2: 認証画面とフォーム部品

**Files:**
- Create: `examples/final/src/adaptor/primary/web/components/FormField.tsx`
- Modify: `examples/final/src/adaptor/primary/web/components/FormErrors.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Login.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Setup.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`

**Interfaces:**
- Consumes: `buttonClassName`, `Layout`.
- Produces: `FormField({ children, description?, error?, field, label }: FormFieldProps): ReactElement` where `children` is the existing input/select/textarea.

- [ ] **Step 1: auth card と field relation の failing assertions を追加する**

```tsx
expect(loginHtml).toContain('class="auth-shell"');
expect(loginHtml).toContain('class="auth-card"');
expect(loginHtml).toContain('class="form-field"');
expect(loginHtml).toContain('autoComplete="email"');
expect(loginHtml).toContain('aria-describedby="email-error"');
expect(loginHtml).toContain('role="alert"');

expect(setupHtml).toContain("最初の管理者を登録");
expect(setupHtml).toContain('class="button button--primary"');
expect(setupHtml).not.toContain('class="app-sidebar"');
```

- [ ] **Step 2: focused test を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/authRoutes.test.ts`

Expected: FAIL on missing `.auth-shell`, `.auth-card`, `.form-field`, and button classes; route behavior remains PASS.

- [ ] **Step 3: FormField と auth page composition を実装する**

```tsx
type FormFieldProps = PropsWithChildren<Readonly<{
  description?: string;
  error?: string;
  field: string;
  label: string;
}>>;

export const FormField = ({ children, description, error, field, label }: FormFieldProps) => (
  <div className="form-field">
    <label className="form-field__label" htmlFor={field}>{label}</label>
    {description === undefined ? null : <p className="form-field__description">{description}</p>}
    {children}
    <FieldError field={field} message={error} />
  </div>
);
```

既存 input の `name`、`type`、`required`、`autoComplete`、`aria-describedby`、`aria-invalid`、`useForm` の submit URL と `forceFormData` は変更しない。各 control へ `id={field}` を付けて `FormField` の `htmlFor` と接続する。`Login` と `Setup` は unauthenticated `Layout` の内側へ `.auth-shell > .auth-card` を置く。

- [ ] **Step 4: auth/form CSS を実装する**

`.auth-shell`、`.auth-card`、`.form-stack`、`.form-field`、input/select/textarea、`.error-summary`、`.error`、primary button の hover/focus/disabled/processing を追加する。入力は 40px、textarea だけ `min-height: 112px` とする。

- [ ] **Step 5: auth focused tests と typecheck を GREEN にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/authRoutes.test.ts test/web/managementPages.test.tsx`

Expected: PASS, including existing setup/login validation and ARIA assertions.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: auth checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/components examples/final/src/adaptor/primary/web/pages/Login.tsx examples/final/src/adaptor/primary/web/pages/Setup.tsx examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/operatorConsolePages.test.tsx
git commit -m "feat(final): 認証フォームをSaaS UIへ統一"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 3: 共通 surface、状態表示、ダッシュボード、予約一覧

**Files:**
- Create: `examples/final/src/adaptor/primary/web/components/StatusBadge.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/DataTable.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/Surface.tsx`
- Create: `examples/final/src/adaptor/primary/web/components/appointmentPresentation.ts`
- Modify: `examples/final/src/adaptor/primary/web/pages/Dashboard.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Interfaces:**
- Produces: `type StatusTone = "neutral" | "info" | "success" | "warning" | "danger"`.
- Produces: `StatusBadge({ children, tone }: PropsWithChildren<{ tone: StatusTone }>)`.
- Produces: `appointmentPresentation(kind: AppointmentPageView["kind"]): { canonical: string; label: string; tone: StatusTone }` with exhaustive switch.
- Produces: `DataTable({ children, label }: PropsWithChildren<{ label: string }>)`.
- Produces: `Card`, `EmptyState`, and `InlineAlert` static components.

- [ ] **Step 1: dashboard/list visual hierarchy の failing tests を追加する**

```tsx
expect(dashboardHtml).toContain('class="metrics-grid"');
expect(dashboardHtml).toContain('class="metric-card"');
expect(dashboardHtml).toContain('aria-label="進行中の予約"');
expect(dashboardHtml).toContain('class="status-badge status-badge--warning"');
expect(dashboardHtml).toContain("診察中");
expect(dashboardHtml).toContain("InExamination");
expect(dashboardHtml).not.toContain("在庫管理");
expect(dashboardHtml).not.toContain("システム通知");
expect(dashboardHtml).not.toContain("検索");

expect(appointmentsHtml).toContain('class="data-table-scroll"');
expect(appointmentsHtml).toContain('class="button button--primary"');
expect(appointmentsHtml).toContain("予約済み");
expect(appointmentsHtml).toContain("Scheduled");
```

- [ ] **Step 2: focused test を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: FAIL on the new class and Japanese state assertions while existing safe DTO assertions remain PASS.

- [ ] **Step 3: pure appointment presentation と surface components を実装する**

```ts
export const appointmentPresentation = (kind: AppointmentPageView["kind"]): AppointmentPresentation => {
  switch (kind) {
    case "Scheduled": return { canonical: kind, label: "予約済み", tone: "neutral" };
    case "CheckedIn": return { canonical: kind, label: "受付済み", tone: "info" };
    case "InExamination": return { canonical: kind, label: "診察中", tone: "warning" };
    case "AwaitingPayment": return { canonical: kind, label: "会計待ち", tone: "warning" };
    case "Paid": return { canonical: kind, label: "会計済み", tone: "success" };
    case "Canceled": return { canonical: kind, label: "キャンセル", tone: "danger" };
    default: return kind satisfies never;
  }
};
```

`DataTable` は `<div className="data-table-scroll"><table aria-label={label}>…</table></div>` だけを担当し、row click は実装しない。詳細遷移は既存 `<Link>` に残す。

- [ ] **Step 4: Dashboard と Appointments/Index を再構成する**

Dashboard は既存四件の `counts` だけを metrics に表示し、`activeAppointments` だけを予約ワークキューへ表示する。`activeAppointments` にない owner、reason、veterinarian、更新時刻は表示しない。Admin/Receptionist だけ header action `新しい予約` を受け取る。

Appointments/Index は既存 `appointments` の日時、状態、ownerName、petName、veterinarianName だけを表に残し、`canBook` の既存 role 判定だけで header action を表示する。

- [ ] **Step 5: dashboard/list CSS と focused GREEN を確認する**

`.metrics-grid` は desktop 4 columns、tablet 2 columns、mobile 1 column とする。`.data-table-scroll` は `overflow-x: auto`、table header は `position: sticky; top: 0`、row は 44px 以上とする。

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts`

Expected: PASS, with no generated placeholder content in SSR HTML.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: dashboard/list checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/components examples/final/src/adaptor/primary/web/pages/Dashboard.tsx examples/final/src/adaptor/primary/web/pages/Appointments/Index.tsx examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/operatorConsolePages.test.tsx examples/final/test/web/securityBoundary.test.ts
git commit -m "feat(final): 診療ダッシュボードと予約一覧を高密度化"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 4: 予約登録と状態別ワークフロー

**Files:**
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/New.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Appointments/Show.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Interfaces:**
- Consumes: `FormField`, `Card`, `InlineAlert`, `StatusBadge`, `appointmentPresentation`, `buttonClassName`, `Layout`.
- Preserves: `actions.checkIn`, `actions.cancel`, `actions.startExamination`, `actions.recordExamResult`, `actions.recordPayment` as the only render gates.

- [ ] **Step 1: appointment workspace の failing tests を追加する**

```tsx
expect(newHtml).toContain('class="form-card"');
expect(newHtml).toContain('class="form-grid"');
expect(newHtml).toContain('aria-describedby="reason-error"');

expect(awaitingPaymentHtml).toContain('class="appointment-workspace"');
expect(awaitingPaymentHtml).toContain('class="appointment-summary"');
expect(awaitingPaymentHtml).toContain('class="workflow-panel"');
expect(awaitingPaymentHtml).toContain("会計待ち");
expect(awaitingPaymentHtml).toContain("会計を記録");
expect(awaitingPaymentHtml).not.toContain("診察結果を記録");

expect(scheduledHtml).toContain('class="workflow-primary"');
expect(scheduledHtml).toContain('class="danger-zone"');
```

- [ ] **Step 2: focused test を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts`

Expected: operator console structure assertions FAIL; existing lifecycle, form payload, PII assertions PASS.

- [ ] **Step 3: booking form を一つの card に再構成する**

既存 `ownerId`、`petId`、`scheduledAt`、`reason` controls を `FormField` で包み、owner/pet を 2-column `.form-grid`、日時と理由を一列にする。owner 選択で pet options を絞る既存 code、`forceFormData`、boolean/form parsing contract は変更しない。

- [ ] **Step 4: appointment detail を状態 summary と workflow panel へ分ける**

```tsx
const presentation = appointmentPresentation(appointment.kind);

<div className="appointment-workspace">
  <section className="appointment-summary" aria-label="予約情報">
    <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>
    <span className="status-canonical">{presentation.canonical}</span>
    {/* exhaustive state-safe chronology remains here */}
  </section>
  <aside className="workflow-panel" aria-label="現在の操作">
    {/* existing action flags gate every form */}
  </aside>
</div>
```

primary lifecycle action は `checkIn`、`startExamination`、`recordExamResult`、`recordPayment` のうち server が許したものを `.workflow-primary` に置く。`cancel` は同じ panel 下部の `.danger-zone` に分離し、既存確認・validation・submit URL を残す。action flag がすべて false の場合は「現在実行できる操作はありません」を表示する。

- [ ] **Step 5: all appointment states と PII boundary を GREEN にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/clinicFlow.test.ts test/web/securityBoundary.test.ts`

Expected: PASS for Scheduled, CheckedIn, InExamination, AwaitingPayment, Paid, Canceled; no clinical free text appears outside existing authorized form controls.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS and the discriminated `AppointmentPageView` negative compile assertions remain effective.

- [ ] **Step 6: appointment workflow checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/pages/Appointments examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/operatorConsolePages.test.tsx examples/final/test/web/securityBoundary.test.ts
git commit -m "feat(final): 予約詳細を状態別ワークスペースへ再設計"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 5: ユーザー・飼い主・ペット管理画面

**Files:**
- Modify: `examples/final/src/adaptor/primary/web/pages/Users/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Users/Form.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Owners/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Owners/Form.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Pets/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Pets/Form.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/managementPages.test.tsx`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`

**Interfaces:**
- Consumes: `DataTable`, `FormField`, `InlineAlert`, `Card`, `EmptyState`, `buttonClassName`, `Layout`.
- Preserves: all existing `useForm` data shapes, POST routes, conflict messages, deletion confirmations, and retained-history copy.

- [ ] **Step 1: management screen hierarchy の failing assertions を追加する**

```tsx
expect(usersHtml).toContain('aria-label="ユーザー一覧"');
expect(usersHtml).toContain('class="table-actions"');
expect(usersHtml).toContain('class="button button--danger"');
expect(usersHtml).toContain("監査履歴は保持されます");

expect(userEditHtml).toContain('class="settings-grid"');
expect(userEditHtml).toContain("プロフィール");
expect(userEditHtml).toContain("パスワードを再設定");

expect(ownerHtml).toContain('class="form-card"');
expect(petHtml).toContain('class="form-card"');
```

- [ ] **Step 2: management page tests を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/managementPages.test.tsx test/web/operatorConsolePages.test.tsx test/web/managementRoutes.test.ts`

Expected: SSR class assertions FAIL; route CRUD, conflict, and deletion behavior remain PASS.

- [ ] **Step 3: three index pages を同じ DataTable pattern に移す**

各 index は `Layout activeNavigation=... actions=...`、`InlineAlert`、`DataTable` の順にする。existing empty copy は `EmptyState` へ移す。delete button は `buttonClassName("danger")` を使う。self delete disabled、owner/pet active-reference conflict、window.confirm の既存条件と文言は変更しない。

- [ ] **Step 4: three form pages を同じ form pattern に移す**

各 control を `FormField` で包み、create/edit title と submit label を残す。`Users/Form` edit mode は `.settings-grid` のプロフィール card と password reset card に分ける。create mode では一つの card だけを表示する。`Pets/Form` edit mode の owner ID は read-only metadata row とし、変更可能な select にしない。

- [ ] **Step 5: focused tests と typecheck を GREEN にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/managementPages.test.tsx test/web/operatorConsolePages.test.tsx test/web/managementRoutes.test.ts`

Expected: PASS, including exact retained audit / non-erasure wording and field-level ARIA.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: management checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/pages/Users examples/final/src/adaptor/primary/web/pages/Owners examples/final/src/adaptor/primary/web/pages/Pets examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/managementPages.test.tsx examples/final/test/web/operatorConsolePages.test.tsx
git commit -m "feat(final): 管理画面の表とフォームを統一"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 6: フォローアップと監査イベント

**Files:**
- Modify: `examples/final/src/adaptor/primary/web/pages/FollowUps/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/pages/Events/Index.tsx`
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify: `examples/final/test/web/securityBoundary.test.ts`

**Interfaces:**
- Consumes: `DataTable`, `StatusBadge`, `InlineAlert`, `EmptyState`, `buttonClassName`, `Layout`.
- Preserves: `followUps[].requested` and checkbox state as the only request availability inputs; `events` remains the scalar-only sanitized audit DTO.

- [ ] **Step 1: operations table の failing tests を追加する**

```tsx
expect(followUpHtml).toContain('aria-label="フォローアップ対象"');
expect(followUpHtml).toContain('class="batch-action-bar"');
expect(followUpHtml).toContain("1件を選択中");
expect(followUpHtml).toContain("未依頼");

expect(eventsHtml).toContain('aria-label="監査イベント一覧"');
expect(eventsHtml).toContain('class="audit-fields"');
expect(eventsHtml).toContain("監査履歴には個人情報を表示しません");
expect(eventsHtml).not.toContain("raw payload");
expect(eventsHtml).not.toContain("<pre");
```

- [ ] **Step 2: focused tests を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts test/web/clinicFlow.test.ts`

Expected: new table/action-bar assertions FAIL; existing follow-up persistence, request conflict, audit redaction tests remain PASS.

- [ ] **Step 3: follow-up selection table と batch action bar を実装する**

既存 checkbox、`appointmentIds` array、requested/processing disabled、submit URL、`forceFormData` を残す。選択数は `form.data.appointmentIds.length` から表示し、0 件では button disabled、requested row は `StatusBadge tone="success"` で「依頼済み」、未依頼は neutral で表示する。

- [ ] **Step 4: sanitized audit table を実装する**

top alert に PII 非表示と履歴保持を記載し、event ID、occurredAt、actor user ID、aggregate name/ID、event name を table columns にする。既存の `aggregateState` と `eventPayload` の scalar entries は cell 内の `<dl className="audit-fields">` で表示し、raw JSON、expand/collapse、copy button を追加しない。

- [ ] **Step 5: focused tests、typecheck、security boundary を GREEN にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/securityBoundary.test.ts test/web/clinicFlow.test.ts`

Expected: PASS and redacted scalar values remain visible without exposing hidden PII.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

- [ ] **Step 6: operations checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web/pages/FollowUps examples/final/src/adaptor/primary/web/pages/Events examples/final/src/adaptor/primary/web/styles.css examples/final/test/web/operatorConsolePages.test.tsx examples/final/test/web/securityBoundary.test.ts
git commit -m "feat(final): フォローアップと監査一覧を運用画面化"
git push origin codex/feat-final-hono-inertia-drizzle
```

---

### Task 7: responsive、accessibility、production verification

**Files:**
- Modify: `examples/final/src/adaptor/primary/web/styles.css`
- Modify: `examples/final/test/web/operatorConsolePages.test.tsx`
- Modify only if verification finds a real UI defect: files from Tasks 1–6 that own that defect.

**Interfaces:**
- Consumes: all shared component class contracts from Tasks 1–6.
- Produces: final desktop/tablet/mobile Operator Console with no page-level horizontal overflow.

- [ ] **Step 1: responsive/accessibility contract の failing static assertions を追加する**

```tsx
expect(shellHtml).toContain('aria-controls="app-navigation"');
expect(shellHtml).toContain('aria-expanded="false"');
expect(shellHtml).toContain('class="mobile-nav-backdrop"');
expect(tableHtml).toContain('class="data-table-scroll"');
expect(errorHtml).toContain('aria-live="polite"');
```

CSS text test では `@media (max-width: 1099px)`、`@media (max-width: 767px)`、`@media (prefers-reduced-motion: reduce)`、`:focus-visible`、`.data-table-scroll { overflow-x: auto; }` が存在することを確認する。

- [ ] **Step 2: responsive contract test を RED にする**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx`

Expected: any missing breakpoint, backdrop, reduced-motion, or focus assertion FAILS.

- [ ] **Step 3: tablet/mobile/reduced-motion CSS を完成する**

`768–1099px` では sidebar を 72px icon rail とし、visible label は隠すが `aria-label` と `title={item.label}` を残して native tooltip でも補う。`<768px` では sidebar を fixed off-canvas にし、menu button と backdrop で開閉する。`.appointment-workspace`、`.settings-grid`、`.form-grid`、`.metrics-grid` は一列へ積む。table だけが横スクロールし、`body` と `.app-main` に `min-width: 0` を設定する。reduced motion では transition duration を 0.01ms にする。

- [ ] **Step 4: focused と package full gates を実行する**

Run: `pnpm --filter @fp-with-ts/clinic-final test -- test/web/operatorConsolePages.test.tsx test/web/managementPages.test.tsx test/web/securityBoundary.test.ts test/web/authRoutes.test.ts test/web/managementRoutes.test.ts test/web/clinicFlow.test.ts`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final typecheck`

Expected: PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final test`

Expected: all package tests PASS.

Run: `pnpm --filter @fp-with-ts/clinic-final build`

Expected: client, SSR, app artifact, and built-entry smoke PASS.

- [ ] **Step 5: running app を三 viewport と keyboard で確認する**

Run: `pnpm --filter @fp-with-ts/clinic-final dev -- --host 127.0.0.1`

Verify:

- 1440×900: 232px sidebar、4 metrics、dense appointment queue、appointment detail 2-column。
- 1024×768: icon rail、2-column metrics、detail action panel stacked below summary。
- 767×900: menu button opens/closes navigation、forms/cards one column、page-level horizontal scrollなし、table containerだけscroll。
- Setup、Login、Admin、Receptionist、Veterinarian の navigation/action visibility。
- Tab/Shift+Tab/Enter/Space だけで menu、navigation、form、logout、workflow action を操作可能。
- Search、notification、inventory、system maintenance、架空件数が表示されない。

- [ ] **Step 6: root gates を実行する**

Run: `pnpm typecheck`

Expected: all examples、docs、worker typecheck PASS with Astro 0 diagnostics.

Run: `pnpm test`

Expected: all examples and docs tests PASS.

Run: `pnpm build`

Expected: all examples and docs builds PASS.

Run: `git diff --check origin/main...HEAD`

Expected: no whitespace errors.

- [ ] **Step 7: final visual checkpoint を commit/push する**

```bash
git add examples/final/src/adaptor/primary/web examples/final/test/web/operatorConsolePages.test.tsx examples/final/test/web/managementPages.test.tsx examples/final/test/web/securityBoundary.test.ts
git commit -m "fix(final): Operator Consoleのレスポンシブ操作を完成"
git push origin codex/feat-final-hono-inertia-drizzle
```

- [ ] **Step 8: Draft PR の checkpoint を確認する**

Run: `gh pr view 31 --json isDraft,headRefName,url,statusCheckRollup`

Expected: `isDraft` is `true`, `headRefName` is `codex/feat-final-hono-inertia-drizzle`, and the latest push is visible. Do not mark the PR ready unless the user explicitly requests it.
