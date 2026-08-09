# Route map

The application uses Hono routes on the server and Inertia page names rather than React Router.

| URL | Inertia page | Source | Shared layout |
| --- | --- | --- | --- |
| `/setup` | `Setup` | `pages/Setup.tsx` | `Layout.tsx` |
| `/login` | `Login` | `pages/Login.tsx` | `Layout.tsx` |
| `/` | `Dashboard` | `pages/Dashboard.tsx` | `Layout.tsx` |
| `/appointments` | `Appointments/Index` | `pages/Appointments/Index.tsx` | `Layout.tsx` |
| `/appointments/new` | `Appointments/New` | `pages/Appointments/New.tsx` | `Layout.tsx` |
| `/appointments/:id` | `Appointments/Show` | `pages/Appointments/Show.tsx` | `Layout.tsx` |
| `/users` | `Users/Index` | `pages/Users/Index.tsx` | `Layout.tsx` |
| `/users/new`, `/users/:id/edit` | `Users/Form` | `pages/Users/Form.tsx` | `Layout.tsx` |
| `/owners` | `Owners/Index` | `pages/Owners/Index.tsx` | `Layout.tsx` |
| `/owners/new`, `/owners/:id/edit` | `Owners/Form` | `pages/Owners/Form.tsx` | `Layout.tsx` |
| `/pets` | `Pets/Index` | `pages/Pets/Index.tsx` | `Layout.tsx` |
| `/pets/new`, `/pets/:id/edit` | `Pets/Form` | `pages/Pets/Form.tsx` | `Layout.tsx` |
| `/follow-ups` | `FollowUps/Index` | `pages/FollowUps/Index.tsx` | `Layout.tsx` |
| `/events` | `Events/Index` | `pages/Events/Index.tsx` | `Layout.tsx` |

Server route modules:

- `routes/authRoutes.ts`: setup, login, logout
- `routes/dashboardRoutes.ts`: dashboard projection
- `routes/appointmentRoutes.ts`: booking and appointment lifecycle
- `routes/userRoutes.ts`: Admin user management
- `routes/ownerRoutes.ts`: owner management
- `routes/petRoutes.ts`: pet management
- `routes/followUpRoutes.ts`: telephone follow-up requests
- `routes/eventRoutes.ts`: Admin audit history

The Inertia client resolves page names with this configuration:

```tsx
const pages = import.meta.glob<{ default: ResolvedComponent }>(
  "./pages/**/*.tsx",
);

void createInertiaApp({
  resolve: async (name) => {
    const loadPage = pages[`./pages/${name}.tsx`];
    if (loadPage === undefined) {
      throw new TypeError(`Unknown Inertia page: ${name}`);
    }
    return (await loadPage()).default;
  },
  setup({ el, App, props }) {
    createRoot(el).render(<App {...props} />);
  },
});
```
