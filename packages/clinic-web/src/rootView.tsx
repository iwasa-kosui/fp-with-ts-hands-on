import { serializePage, type PageObject, type RootView } from "@hono/inertia";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const reactRefreshPreamble = `import { injectIntoGlobalHook } from "/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`;

const Document = ({
  developmentClientSource,
  isProduction,
  page,
}: Readonly<{
  developmentClientSource: string;
  isProduction: boolean;
  page: PageObject;
}>): ReactElement => {
  const clientSource = isProduction
    ? "/static/client.js"
    : developmentClientSource;

  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>関数型どうぶつ病院</title>
        {isProduction ? (
          <link rel="stylesheet" href="/static/styles.css" />
        ) : (
          <script type="module">{reactRefreshPreamble}</script>
        )}
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

export const createClinicRootView = (
  isProduction: boolean,
  developmentClientSource = "/src/web/client.tsx",
): RootView =>
  async (page, context) => {
    const html = `<!DOCTYPE html>${renderToStaticMarkup(
      <Document
        developmentClientSource={developmentClientSource}
        isProduction={isProduction}
        page={page}
      />,
    )}`;
    const vite = context.env?.vite;

    if (isProduction || vite === undefined) {
      return html;
    }

    return vite.transformIndexHtml(context.req.path, html);
  };
