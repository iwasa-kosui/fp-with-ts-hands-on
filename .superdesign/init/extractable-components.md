# Extractable components

## Layout

### AppShell

- Source: `examples/final/src/adaptor/primary/web/pages/Layout.tsx`
- Category: layout
- Description: Shared authenticated shell with clinic brand, role-aware navigation, user role, logout, page title, and content slot.
- Extractable props: `activeItem` (string, default `dashboard`), `role` (string, default `Admin`), `authenticated` (boolean, default `true`).
- Hardcoded: clinic brand, navigation labels, logout label, all visual styles.

## Basic

### ErrorSummary

- Source: `examples/final/src/adaptor/primary/web/components/FormErrors.tsx`
- Category: basic
- Description: Accessible alert summary for server-side form errors.
- Extractable props: `visible` (boolean, default `true`).
- Hardcoded: error heading and example field messages.

There are no reusable Button, Input, Card, Badge, Table, Avatar, or EmptyState components yet. Establishing these primitives is part of the redesign opportunity.
