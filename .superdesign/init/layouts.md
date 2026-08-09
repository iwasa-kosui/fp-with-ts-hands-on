# Shared layouts

## `examples/final/src/adaptor/primary/web/pages/Layout.tsx`

The single application shell renders a horizontal brand header, role-dependent navigation, a logout action, and one centered main column.

```tsx
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
```

## `examples/final/src/adaptor/primary/web/rootView.tsx`

The Hono/Inertia document shell loads the production stylesheet or the development client entry.

```tsx
import { serializePage, type PageObject, type RootView } from "@hono/inertia";
import { renderToStaticMarkup } from "react-dom/server";

const Document = ({
  page,
  isProduction,
}: Readonly<{ page: PageObject; isProduction: boolean }>) => {
  const clientSource = isProduction
    ? "/static/client.js"
    : "/src/adaptor/primary/web/client.tsx";

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>関数型どうぶつ病院</title>
        {isProduction ? (
          <link rel="stylesheet" href="/static/styles.css" />
        ) : null}
        <script type="module" src={clientSource} />
      </head>
      <body>
        <script
          data-page="app"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serializePage(page) }}
        />
        <div id="app" />
      </body>
    </html>
  );
};

export const createRootView = (isProduction: boolean): RootView => (page) =>
  `<!DOCTYPE html>${renderToStaticMarkup(
    <Document page={page} isProduction={isProduction} />,
  )}`;
```
