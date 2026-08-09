# Clinic Operations SaaS Design System

## Product context

This is a role-aware veterinary clinic operations application built with Hono, Inertia, and React. Admins manage users and audit history; receptionists manage owners, pets, appointments, payments, and follow-ups; veterinarians start examinations and record results. The UI is used primarily on clinic desktop PCs, with tablet-safe responsive behavior.

The design should feel like a mature B2B SaaS product: fast to scan, calm under pressure, information-dense without feeling cramped, and visibly trustworthy. Do not make it look like a consumer pet app, a playful landing page, or a generic template dashboard.

## Visual direction

- Tone: precise, operational, modern, restrained.
- Layout: persistent left sidebar on desktop, compact utility top bar, wide content canvas, predictable page header, clear primary action.
- Density: 13–14px operational text; compact rows and controls; 8px spacing rhythm.
- Surfaces: cool white cards on a very light slate app background. Prefer borders and subtle tonal separation over heavy shadows.
- Brand character: a small clinic mark and restrained animal-health cues are welcome, but never use emoji as production icons.

## Color tokens

- `--app-bg`: `#F4F7FB`
- `--surface`: `#FFFFFF`
- `--surface-subtle`: `#F8FAFC`
- `--surface-active`: `#EEF2FF`
- `--border`: `#E2E8F0`
- `--border-strong`: `#CBD5E1`
- `--text`: `#0F172A`
- `--text-muted`: `#64748B`
- `--text-subtle`: `#94A3B8`
- `--primary`: `#4F46E5`
- `--primary-hover`: `#4338CA`
- `--primary-soft`: `#EEF2FF`
- `--success`: `#0F766E`
- `--success-soft`: `#CCFBF1`
- `--warning`: `#B45309`
- `--warning-soft`: `#FEF3C7`
- `--danger`: `#B91C1C`
- `--danger-soft`: `#FEE2E2`
- `--info`: `#0369A1`
- `--info-soft`: `#E0F2FE`

Use indigo only for navigation selection, primary actions, links, and focus rings. State colors communicate meaning and must not become decoration. Do not introduce gradients, neon colors, purple-pink palettes, glassmorphism, or dark mode in this scope.

## Typography

- Font family: `Inter, "Noto Sans JP", ui-sans-serif, system-ui, sans-serif`.
- Page title: 24px / 32px, 700.
- Section title: 16px / 24px, 650.
- Body: 14px / 21px, 400–500.
- Table and metadata: 13px / 20px.
- Labels and overlines: 12px / 16px, 600.
- Numeric metrics: tabular numerals, 26–30px, 700.

## Spacing, geometry, and elevation

- Spacing rhythm: 4, 8, 12, 16, 20, 24, 32px.
- Desktop sidebar: 232px expanded; collapse below 1100px.
- Content max width: 1440px with 24–32px gutters.
- Control height: 36px compact, 40px primary forms.
- Radius: 8px controls, 10px cards, 12px prominent panels. Avoid pill shapes except compact status badges.
- Border: 1px solid `--border`.
- Shadow: only floating menus/dialogs use `0 12px 30px rgba(15, 23, 42, 0.12)`; cards remain mostly border-defined.

## Components

- Sidebar: clinic mark, grouped role-aware navigation, icon + label, active item on indigo-soft surface, user block anchored at bottom.
- Top bar: breadcrumb/page context, optional search or shortcut affordance, no duplicate navigation.
- Page header: title, one-line description or state summary, primary action at right.
- Button: primary indigo, secondary white/border, ghost, and destructive red. Include hover, focus-visible, processing, and disabled states.
- Input/select/textarea: clear labels above, 40px height, slate border, indigo focus ring, error text directly below.
- Card: white surface, 1px border, 10px radius, compact header/body spacing.
- Table: sticky-capable header, 44px rows, muted metadata, row hover, actions aligned right, horizontal scroll on tablet.
- Status badge: semantic color with text label; never rely on color alone.
- Empty state: concise explanation and one relevant action, not decorative illustration-heavy content.
- Alert: icon, concise title, optional details; retain accessible `role="alert"` semantics.

## Dashboard

- Top page header with current date/clinic context and the primary action `新しい予約` for authorized roles.
- Four compact metric cards for owners, pets, appointments, and active appointments.
- Main area: active appointment queue as a dense structured list/table with pet, scheduled time, lifecycle badge, and direct detail action.
- Secondary panel: operational shortcuts or state breakdown. Do not fabricate clinical content not present in the Inertia props.

## Appointment workflow

- Appointment detail uses a two-column desktop layout: identity/status summary and chronological metadata on the left; the single currently valid workflow action in a focused action card on the right.
- The current state is prominent and Japanese-readable while preserving the canonical state name as secondary metadata when useful.
- Do not show multiple competing action forms. Invalid actions remain absent according to server-projected action flags.
- Sensitive clinical free text appears only in authorized forms and must not be echoed into general summary cards.

## Responsive behavior

- Desktop ≥1100px: full sidebar and wide two-column content where useful.
- Tablet 768–1099px: collapsed icon rail or compact drawer trigger; cards may become two columns; detail action panel stacks below summary.
- Mobile <768px: supported without overflow, but desktop operational density remains the primary target. Tables become horizontally scrollable or card rows where semantics remain clear.

## Motion and interaction

- 120–180ms transitions for hover, focus, sidebar collapse, and disclosure only.
- Respect `prefers-reduced-motion`.
- No large entrance animations, parallax, animated gradients, or attention-seeking motion.

## Accessibility and constraints

- WCAG AA contrast, visible focus rings, keyboard-accessible navigation and actions.
- Preserve semantic headings, forms, labels, tables, alerts, and role-aware hidden actions.
- Preserve all existing Hono/Inertia behavior, DTO boundaries, validation messages, and server-side authorization.
- Use only the fonts, colors, spacing, and component styles defined here. Do not introduce any visual styles outside this design system.
