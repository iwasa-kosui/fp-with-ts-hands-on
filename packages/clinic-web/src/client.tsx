import {
  createInertiaApp,
  type ResolvedComponent,
} from "@inertiajs/react";
import { createRoot } from "react-dom/client";

import ClinicDashboard from "./ClinicDashboard.js";

export const startClinicClient = (): void => {
  void createInertiaApp({
    resolve: (name) => {
      if (name !== "ClinicDashboard") {
        throw new TypeError(`Unknown Inertia page: ${name}`);
      }
      return ClinicDashboard as unknown as ResolvedComponent;
    },
    setup({ el, App, props }) {
      createRoot(el).render(<App {...props} />);
    },
  });
};
