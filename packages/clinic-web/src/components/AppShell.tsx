import { Link } from "@inertiajs/react";
import { useState, type ReactElement, type ReactNode } from "react";

import type { ClinicUserView } from "../contracts.js";
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
  user?: ClinicUserView | null | undefined;
}>;

type NavigationItem = Readonly<{
  href: string;
  icon: IconName;
  key: NavigationKey;
  label: string;
  roles: readonly ClinicUserView["role"][];
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
        <main className="app-content app-main">{children}</main>
      </div>
    );
  }

  return (
    <div
      className={
        isNavigationOpen
          ? "app-shell app-shell--navigation-open"
          : "app-shell"
      }
    >
      <button
        aria-controls="app-navigation"
        aria-expanded={isNavigationOpen}
        aria-label={isNavigationOpen ? "ナビゲーションを閉じる" : "ナビゲーションを開く"}
        className="navigation-toggle"
        onClick={() => setIsNavigationOpen((isOpen) => !isOpen)}
        type="button"
      >
        <Icon name="menu" />
      </button>
      <button
        aria-label="ナビゲーションを閉じる"
        className="navigation-backdrop"
        onClick={() => setIsNavigationOpen(false)}
        type="button"
      />
      <aside aria-label="アプリケーションサイドバー" className="app-sidebar">
        <div className="app-sidebar__brand">
          <Link className="brand" href="/">
            <Icon name="paw" />
            <span>関数型どうぶつ病院</span>
          </Link>
        </div>
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
                title={item.label}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>
        <div className="app-sidebar__user">
          <span className="role">{user.role}</span>
          <Link
            aria-label="ログアウト"
            as="button"
            className="app-sidebar__logout"
            href="/logout"
            method="post"
            title="ログアウト"
          >
            <Icon name="logout" />
            <span>ログアウト</span>
          </Link>
        </div>
      </aside>
      <main className="app-content app-main">
        <header className="top-bar">
          <p>{title}</p>
          <span>{user.role}</span>
        </header>
        <div className="app-content__inner">{children}</div>
      </main>
    </div>
  );
};
