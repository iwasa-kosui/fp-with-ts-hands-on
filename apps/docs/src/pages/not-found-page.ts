export const renderNotFoundPage = (pathname: string): HTMLElement => {
  const page = document.createElement("main");
  page.className = "not-found-page";

  const heading = document.createElement("h1");
  heading.textContent = "ページが見つかりません";
  const detail = document.createElement("p");
  detail.textContent = `${pathname} に対応するページはありません。`;

  const navigation = document.createElement("nav");
  navigation.ariaLabel = "復帰先";
  const home = document.createElement("a");
  home.href = "/";
  home.textContent = "トップへ戻る";
  const modules = document.createElement("a");
  modules.href = "/#modules";
  modules.textContent = "モジュール一覧へ戻る";
  navigation.append(home, modules);

  page.append(heading, detail, navigation);
  return page;
};
