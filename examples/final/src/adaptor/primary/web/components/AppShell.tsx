import { Link } from "@inertiajs/react";
import { useState, type ReactElement, type ReactNode } from "react";

import type { AuthenticatedUserView } from "../pageProps.js";
import { Icon, type IconName } from "./Icon.js";

export type NavigationKey =
  | "dashboard"
  | "appointments"
  | "users"
  | "owners"
  | "pets"
  | "follow-ups"
  | "events";

type AppShellProps = Readonly<{
  activeNavigation?: NavigationKey | undefined;
  children: ReactNode;
  title: string;
  user?: AuthenticatedUserView | null | undefined;
}>;

type NavigationItem = Readonly<{
  href: string;
  icon: IconName;
  key: NavigationKey;
  label: string;
  roles: readonly AuthenticatedUserView["role"][];
}>;

const navigationItems: readonly NavigationItem[] = [
  {
    key: "dashboard",
    href: "/",
    label: "ダッシュボード",
    icon: "dashboard",
    roles: ["Admin", "Receptionist", "Veterinarian"],
  },
  {
    key: "appointments",
    href: "/appointments",
    label: "予約",
    icon: "calendar",
    roles: ["Admin", "Receptionist", "Veterinarian"],
  },
  {
    key: "users",
    href: "/users",
    label: "ユーザー",
    icon: "users",
    roles: ["Admin"],
  },
  {
    key: "owners",
    href: "/owners",
    label: "飼い主",
    icon: "owners",
    roles: ["Admin", "Receptionist"],
  },
  {
    key: "pets",
    href: "/pets",
    label: "ペット",
    icon: "paw",
    roles: ["Admin", "Receptionist"],
  },
  {
    key: "follow-ups",
    href: "/follow-ups",
    label: "フォローアップ",
    icon: "followUp",
    roles: ["Admin", "Receptionist"],
  },
  {
    key: "events",
    href: "/events",
    label: "イベント",
    icon: "events",
    roles: ["Admin"],
  },
];

export const AppShell = ({
  activeNavigation,
  children,
  title,
  user,
}: AppShellProps): ReactElement => {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);

  if (user === undefined || user === null) {
    return (
      <div className="app-shell app-shell--public">
        <main className="app-content">{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside aria-label="アプリケーションサイドバー" className="app-sidebar">
        <div className="app-sidebar__brand">
          <Link className="brand" href="/">
            <Icon name="paw" />
            <span>関数型どうぶつ病院</span>
          </Link>
        </div>
        <button
          aria-controls="app-navigation"
          aria-expanded={isNavigationOpen}
          aria-label="ナビゲーションを開く"
          className="navigation-toggle"
          onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
          type="button"
        >
          <Icon name="menu" />
        </button>
        <nav
          aria-label="メインナビゲーション"
          className="app-navigation"
          id="app-navigation"
        >
          {navigationItems
            .filter((item) => item.roles.includes(user.role))
            .map((item) => (
              <Link
                aria-current={activeNavigation === item.key ? "page" : undefined}
                aria-label={item.label}
                className={
                  activeNavigation === item.key
                    ? "app-navigation__link app-navigation__link--active"
                    : "app-navigation__link"
                }
                href={item.href}
                key={item.key}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
        <div className="app-sidebar__user">
          <span className="role">{user.role}</span>
          <Link as="button" className="app-sidebar__logout" href="/logout" method="post">
            <Icon name="logout" />
            <span>ログアウト</span>
          </Link>
        </div>
      </aside>
      <main className="app-content">
        <header className="top-bar">
          <p>{title}</p>
          <span>{user.role}</span>
        </header>
        <div className="app-content__inner">{children}</div>
      </main>
    </div>
  );
};
