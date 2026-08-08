import { Link } from "@inertiajs/react";
import type { PropsWithChildren } from "react";

import type { AuthenticatedUserView } from "../pageProps.js";

type LayoutProps = PropsWithChildren<
  Readonly<{
    user?: AuthenticatedUserView | null;
    title: string;
  }>
>;

export default function Layout({ children, title, user }: LayoutProps) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" href="/">
          関数型どうぶつ病院
        </Link>
        {user === undefined || user === null ? null : (
          <nav aria-label="メインナビゲーション">
            <Link href="/">ダッシュボード</Link>
            <Link href="/appointments">予約</Link>
            {user.role === "Admin" ? (
              <Link href="/users">ユーザー</Link>
            ) : null}
            {user.role === "Admin" || user.role === "Receptionist" ? (
              <>
                <Link href="/owners">飼い主</Link>
                <Link href="/pets">ペット</Link>
                <Link href="/follow-ups">フォローアップ</Link>
              </>
            ) : null}
            {user.role === "Admin" ? (
              <Link href="/events">イベント</Link>
            ) : null}
            <span className="role">{user.role}</span>
            <Link as="button" href="/logout" method="post">
              ログアウト
            </Link>
          </nav>
        )}
      </header>
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    </div>
  );
}
