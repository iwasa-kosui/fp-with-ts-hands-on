import type { PropsWithChildren, ReactNode } from "react";

import {
  AppShell,
  type NavigationKey,
} from "@fp-with-ts/clinic-web";
import { PageHeader } from "@fp-with-ts/clinic-web";
import type { AuthenticatedUserView } from "../pageProps.js";

type LayoutProps = PropsWithChildren<
  Readonly<{
    activeNavigation?: NavigationKey;
    actions?: ReactNode;
    description?: string;
    title: string;
    user?: AuthenticatedUserView | null;
  }>
>;

export default function Layout(props: LayoutProps) {
  return (
    <AppShell
      activeNavigation={props.activeNavigation}
      title={props.title}
      user={props.user}
    >
      <PageHeader
        actions={props.actions}
        description={props.description}
        title={props.title}
      />
      {props.children}
    </AppShell>
  );
}
