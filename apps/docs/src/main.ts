import "./styles/base.css";
import { renderCodeBlock } from "./components/code-block";
import { renderModuleCard } from "./components/module-card";
import { moduleById, modules, type ModuleContent } from "./content/modules";

const phases = ["要求追加", "インシデント", "赤テスト", "編集", "緑テスト", "エージェントレビュー"] as const;

const createElement = <TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  className?: string,
): HTMLElementTagNameMap[TagName] => {
  const element = document.createElement(tagName);
  if (className !== undefined) element.className = className;
  return element;
};

const routeModule = (): ModuleContent | undefined => {
  const [, route] = location.hash.split("#");
  const match = route?.match(/^\/modules\/([^/]+)$/);
  return match?.[1] === undefined ? undefined : moduleById(match[1]);
};

const moduleHref = (module: ModuleContent): string => `#/modules/${module.id}`;

const renderHeader = (): HTMLElement => {
  const header = createElement("header", "topbar");
  const brand = createElement("a", "brand");
  brand.href = "#/";
  brand.innerHTML = '<span class="brand-mark" aria-hidden="true">AC</span><span>Animal Clinic<br />TypeScript Hands-on</span>';
  const meta = createElement("p", "event-meta");
  meta.textContent = "2026.08.30 / 15:00-18:00";
  header.append(brand, meta);
  return header;
};

const renderModuleLink = (module: ModuleContent, current?: ModuleContent): HTMLAnchorElement => {
  const link = createElement("a", "module-link");
  link.href = moduleHref(module);
  link.setAttribute("aria-current", module.id === current?.id ? "page" : "false");
  const marker = createElement("span", `animal-marker animal-marker--${module.animal}`);
  marker.textContent = module.animalLabel;
  const text = createElement("span");
  text.innerHTML = `<small>${module.id} / ${module.minutes} min</small>${module.title}`;
  link.append(marker, text);
  return link;
};

const renderSidebar = (current?: ModuleContent): HTMLElement => {
  const aside = createElement("aside", "sidebar");
  const heading = createElement("p", "eyebrow");
  heading.textContent = "本日の診療順";
  const total = createElement("p", "sidebar-total");
  total.textContent = "7 modules / 150 min";
  const nav = createElement("nav", "module-list");
  nav.setAttribute("aria-label", "module navigation");
  modules.forEach((module) => nav.append(renderModuleLink(module, current)));
  aside.append(heading, total, nav);
  return aside;
};

const renderMobileNav = (current?: ModuleContent): HTMLElement => {
  const nav = createElement("nav", "mobile-nav");
  nav.setAttribute("aria-label", "mobile module navigation");
  modules.forEach((module) => nav.append(renderModuleLink(module, current)));
  return nav;
};

const renderSummary = (module: ModuleContent): HTMLElement => {
  const aside = createElement("aside", "summary");
  const title = createElement("p", "summary__title");
  title.textContent = "今回のカルテ";
  const entries: ReadonlyArray<readonly [string, string, string]> = [
    ["要求追加", module.newRequest, "request"],
    ["発生した事故", module.incident, "incident"],
    ["守りたい不変条件", module.invariant, "invariant"],
    ["次に実行するコマンド", module.redCommand, "command"],
  ];
  entries.forEach(([label, value, kind]) => {
    const entry = createElement("div", `summary__entry summary__entry--${kind}`);
    const labelElement = createElement("dt");
    labelElement.textContent = label;
    const valueElement = createElement("dd");
    valueElement.textContent = value;
    entry.append(labelElement, valueElement);
    aside.append(entry);
  });
  return aside;
};

const renderPhaseFlow = (module: ModuleContent): HTMLElement => {
  const section = createElement("section", "phase-flow");
  const title = createElement("h2");
  title.textContent = "診療フロー";
  const list = createElement("ol");
  const values = [module.newRequest, module.incident, module.redCommand, module.editTarget, module.greenCommand, module.agentReview];
  phases.forEach((phase, index) => {
    const item = createElement("li");
    const phaseName = createElement("strong");
    phaseName.textContent = phase;
    const detail = createElement("span");
    detail.textContent = values[index] ?? "";
    item.append(phaseName, detail);
    list.append(item);
  });
  section.append(title, list);
  return section;
};

const renderSources = (module: ModuleContent): HTMLElement | undefined => {
  if (module.sourceLinks.length === 0) return undefined;
  const section = createElement("section", "source-links");
  const heading = createElement("h2");
  heading.textContent = "参考記事";
  const list = createElement("ul");
  module.sourceLinks.forEach((source) => {
    const item = createElement("li");
    const link = createElement("a");
    link.href = source.href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.label;
    item.append(link);
    list.append(item);
  });
  section.append(heading, list);
  return section;
};

const renderModule = (module: ModuleContent): HTMLElement => {
  const page = createElement("main", "module-page");
  const intro = createElement("section", "module-intro");
  const meta = createElement("p", "eyebrow");
  meta.textContent = `${module.id} / ${module.minutes} min / ${module.animalLabel}`;
  const title = createElement("h1");
  title.textContent = module.title;
  const done = createElement("p", "module-intro__done");
  done.textContent = `ここまでできたら OK: ${module.doneWhen}`;
  intro.append(meta, title, done);

  const top = createElement("div", "module-top");
  top.append(intro, renderSummary(module));
  page.append(top, renderPhaseFlow(module));

  const details = createElement("div", "module-details");
  module.sections.forEach((content) => {
    const section = createElement("section", "content-section");
    const heading = createElement("h2");
    heading.textContent = content.heading;
    const body = createElement("p");
    body.textContent = content.body;
    section.append(heading, body);
    if (content.code !== undefined) section.append(renderCodeBlock(content.code.value, content.code.language));
    details.append(section);
  });
  page.append(details);

  const sources = renderSources(module);
  if (sources !== undefined) page.append(sources);

  const index = modules.findIndex(({ id }) => id === module.id);
  const navigation = createElement("nav", "pager");
  navigation.setAttribute("aria-label", "previous and next module");
  const previous = modules[index - 1];
  const next = modules[index + 1];
  if (previous !== undefined) {
    const link = createElement("a");
    link.href = moduleHref(previous);
    link.textContent = `Previous: ${previous.title}`;
    navigation.append(link);
  }
  if (next !== undefined) {
    const link = createElement("a");
    link.href = moduleHref(next);
    link.textContent = `Next: ${next.title}`;
    navigation.append(link);
  }
  page.append(navigation);
  return page;
};

const renderHome = (): HTMLElement => {
  const main = createElement("main", "home-page");
  const intro = createElement("section", "home-intro");
  const eyebrow = createElement("p", "eyebrow");
  eyebrow.textContent = "Animal Clinic Reservation & Chart System";
  const heading = createElement("h1");
  heading.textContent = "次の変更でも壊れにくい、動物病院をつくる。";
  const body = createElement("p");
  body.textContent = "予約とカルテの事故を起こし、型・境界・失敗値・変更記録で一つずつ受け止める 3 時間の TypeScript hands-on です。";
  const start = createElement("a", "start-link");
  start.href = moduleHref(modules[0]!);
  start.textContent = "診療をはじめる";
  intro.append(eyebrow, heading, body, start);
  main.append(intro);

  const schedule = createElement("section", "schedule");
  const scheduleHeading = createElement("h2");
  scheduleHeading.textContent = "本日のタイムテーブル";
  const list = createElement("div", "schedule-list");
  modules.forEach((module) => {
    const link = createElement("a");
    link.href = moduleHref(module);
    link.append(renderModuleCard(module));
    list.append(link);
  });
  schedule.append(scheduleHeading, list);
  main.append(schedule);
  return main;
};

const renderApp = (): void => {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (app === null) throw new Error("#app was not found");
  const current = routeModule();
  const shell = createElement("div", "app-shell");
  shell.append(renderHeader(), renderMobileNav(current));
  const workspace = createElement("div", "workspace");
  workspace.append(renderSidebar(current), current === undefined ? renderHome() : renderModule(current));
  shell.append(workspace);
  app.replaceChildren(shell);
};

window.addEventListener("hashchange", renderApp);
renderApp();
