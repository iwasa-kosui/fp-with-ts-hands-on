import { serializePage, type PageObject, type RootView } from "@hono/inertia";
import { renderToStaticMarkup } from "react-dom/server";

const Document = ({ page }: Readonly<{ page: PageObject }>) => {
  const isProduction = process.env.NODE_ENV === "production";
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

export const rootView: RootView = (page) =>
  `<!DOCTYPE html>${renderToStaticMarkup(<Document page={page} />)}`;
