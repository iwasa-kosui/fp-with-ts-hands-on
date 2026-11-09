import { sessionNavigationItems } from "../navigation";
import type { SessionPage } from "./types";

export type SessionPageLink = Readonly<{ href: string; title: string }>;

export type SessionPageEntry = Readonly<{
  page: SessionPage;
  href: string;
  previous: SessionPageLink | undefined;
  next: SessionPageLink | undefined;
  later: Readonly<{ href: string; count: number }> | undefined;
  position: string;
}>;

export const sessionPageHref = (sessionSlug: string, pageSlug: string) =>
  pageSlug === ""
    ? `/sessions/${sessionSlug}/`
    : `/sessions/${sessionSlug}/${pageSlug}/`;

export const formatMinutes = (minutes: number) =>
  minutes === 0 ? "時間外" : `${minutes}分`;

export const sessionPageEntries = (
  sessionSlug: string,
  pages: readonly SessionPage[],
): readonly SessionPageEntry[] => {
  const sessionIndex = sessionNavigationItems.findIndex(
    ({ slug }) => slug === sessionSlug,
  );
  const toSessionLink = (index: number): SessionPageLink | undefined => {
    const item = sessionNavigationItems[index];
    return item === undefined
      ? undefined
      : { href: `/sessions/${item.slug}/`, title: item.title };
  };
  const toPageLink = (page: SessionPage): SessionPageLink => ({
    href: sessionPageHref(sessionSlug, page.slug),
    title: page.title,
  });

  const timed = pages.filter(({ kind }) => kind !== "advanced");
  const advanced = pages.filter(({ kind }) => kind === "advanced");
  const lastTimed = timed.at(-1);
  const firstAdvanced = advanced.at(0);

  return pages.map((page, index) => {
    const following = pages[index + 1];
    const isAdvanced = page.kind === "advanced";
    const preceding = pages[index - 1];
    return {
      page,
      href: sessionPageHref(sessionSlug, page.slug),
      previous:
        preceding === undefined
          ? toSessionLink(sessionIndex - 1)
          : toPageLink(preceding),
      next:
        following === undefined || page === lastTimed
          ? toSessionLink(sessionIndex + 1)
          : toPageLink(following),
      later:
        page === lastTimed && firstAdvanced !== undefined
          ? {
              href: sessionPageHref(sessionSlug, firstAdvanced.slug),
              count: advanced.length,
            }
          : undefined,
      position: isAdvanced
        ? `発展 ${advanced.indexOf(page) + 1} / ${advanced.length}`
        : `${timed.indexOf(page) + 1} / ${timed.length}`,
    };
  });
};

export const sessionPageStaticPaths = (pages: readonly SessionPage[]) =>
  pages
    .filter(({ slug }) => slug !== "")
    .map(({ slug }) => ({ params: { page: slug } }));
