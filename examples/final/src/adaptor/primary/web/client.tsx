import {
  createInertiaApp,
  type ResolvedComponent,
} from "@inertiajs/react";
import { createRoot } from "react-dom/client";

import "@fp-with-ts/clinic-web/styles.css";

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
