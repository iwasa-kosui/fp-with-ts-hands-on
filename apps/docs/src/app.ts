import { renderHomePage } from "./pages/home-page";
import { renderModulePage } from "./pages/module-page";
import { renderNotFoundPage } from "./pages/not-found-page";
import { resolveRoute } from "./routes";

export const startApp = (
  root: HTMLElement,
  browserWindow: Window = window,
): (() => void) => {
  const render = (): void => {
    const route = resolveRoute(browserWindow.location.pathname);
    if (route.kind !== "not-found" && route.canonicalPath !== browserWindow.location.pathname) {
      browserWindow.history.replaceState({}, "", route.canonicalPath);
    }

    root.replaceChildren(
      route.kind === "home"
        ? renderHomePage()
        : route.kind === "module"
          ? renderModulePage(route.module)
          : renderNotFoundPage(route.pathname),
    );
    browserWindow.scrollTo({ top: 0 });
    const heading = root.querySelector<HTMLElement>("h1");
    if (heading !== null) {
      heading.tabIndex = -1;
      heading.focus();
    }
  };

  const handleClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (
      anchor === null ||
      anchor.hasAttribute("target") ||
      anchor.hasAttribute("download")
    ) {
      return;
    }

    const destination = new URL(anchor.href, browserWindow.location.href);
    if (destination.origin !== browserWindow.location.origin) return;

    event.preventDefault();
    browserWindow.history.pushState({}, "", destination.href);
    render();
  };

  browserWindow.addEventListener("popstate", render);
  root.addEventListener("click", handleClick);
  render();

  return () => {
    browserWindow.removeEventListener("popstate", render);
    root.removeEventListener("click", handleClick);
  };
};
