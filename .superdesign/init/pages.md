# Key page dependency trees

All paths are relative to `examples/final/src/adaptor/primary/web/`.

## `/` — Dashboard

Entry: `pages/Dashboard.tsx`

- `pages/Layout.tsx`
  - `pageProps.ts`
- `routes/appointmentRoutes.ts` (types only)
- `../../../../useCase/getDashboardUseCase.ts` (types only)

## `/appointments` — Appointment list

Entry: `pages/Appointments/Index.tsx`

- `pages/Layout.tsx`
  - `pageProps.ts`
- `routes/appointmentRoutes.ts` (types only)

## `/appointments/new` — Appointment booking

Entry: `pages/Appointments/New.tsx`

- `components/FormErrors.tsx`
  - `pageProps.ts`
- `pages/Layout.tsx`
- `routes/appointmentRoutes.ts` (types only)

## `/appointments/:id` — Appointment detail and workflow actions

Entry: `pages/Appointments/Show.tsx`

- `components/FormErrors.tsx`
  - `pageProps.ts`
- `pages/Layout.tsx`
- `routes/appointmentRoutes.ts` (types only)

## `/users` — User management

Entry: `pages/Users/Index.tsx`

- `pages/Layout.tsx`
- `pageProps.ts`
- `../../../../useCase/listUsersUseCase.ts` (types only)

## `/users/new` and `/users/:id/edit` — User form

Entry: `pages/Users/Form.tsx`

- `components/FormErrors.tsx`
- `pages/Layout.tsx`
- `pageProps.ts`

## `/owners` — Owner management

Entry: `pages/Owners/Index.tsx`

- `pages/Layout.tsx`
- `pageProps.ts`
- owner use-case DTO modules (types only)

## `/pets` — Pet management

Entry: `pages/Pets/Index.tsx`

- `pages/Layout.tsx`
- `pageProps.ts`
- pet use-case DTO modules (types only)

## `/follow-ups` — Follow-up queue

Entry: `pages/FollowUps/Index.tsx`

- `pages/Layout.tsx`
- `pageProps.ts`
- follow-up use-case DTO modules (types only)

## `/events` — Audit history

Entry: `pages/Events/Index.tsx`

- `pages/Layout.tsx`
- `pageProps.ts`
- `../../../../useCase/query/eventHistoryReader.ts` (types only)

Every page also receives styles from `styles.css` through `client.tsx` and is rendered inside `rootView.tsx`.
