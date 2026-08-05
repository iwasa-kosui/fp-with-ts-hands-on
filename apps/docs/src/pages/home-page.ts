import { renderModuleCard } from "../components/module-card";
import { homeContent } from "../content/home";
import { modules } from "../content/modules";

const createHeading = (text: string): HTMLHeadingElement => {
  const heading = document.createElement("h2");
  heading.textContent = text;
  return heading;
};

const createParagraph = (text: string): HTMLParagraphElement => {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  return paragraph;
};

const createList = (items: readonly string[]): HTMLUListElement => {
  const list = document.createElement("ul");
  for (const item of items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.append(listItem);
  }
  return list;
};

const createSection = (title: string, ...children: readonly Node[]): HTMLElement => {
  const section = document.createElement("section");
  section.append(createHeading(title), ...children);
  return section;
};

const renderSiteHeader = (): HTMLElement => {
  const header = document.createElement("header");
  header.className = "site-header";
  const navigation = document.createElement("nav");
  navigation.ariaLabel = "サイトナビゲーション";
  const home = document.createElement("a");
  home.href = "/";
  home.textContent = "FP with TypeScript トップ";
  navigation.append(home);
  header.append(navigation);
  return header;
};

const renderHero = (): HTMLElement => {
  const hero = document.createElement("section");
  hero.className = "home-hero";
  const title = document.createElement("h1");
  title.textContent = homeContent.title;
  hero.append(title, createParagraph(homeContent.lead), createParagraph(homeContent.promise));
  return hero;
};

const renderAudience = (): HTMLElement =>
  createSection(
    homeContent.audience.title,
    createParagraph(homeContent.audience.introduction),
    createList(homeContent.audience.items),
  );

const renderEvent = (): HTMLElement => {
  const details = document.createElement("dl");
  for (const detail of homeContent.event.details) {
    const term = document.createElement("dt");
    term.textContent = detail.label;
    const description = document.createElement("dd");
    description.textContent = detail.value;
    details.append(term, description);
  }
  return createSection(homeContent.event.title, details);
};

const renderLearningFlow = (): HTMLElement => {
  const list = document.createElement("ol");
  for (const step of homeContent.learningFlow.items) {
    const item = document.createElement("li");
    item.textContent = step;
    list.append(item);
  }
  return createSection(
    homeContent.learningFlow.title,
    createParagraph(homeContent.learningFlow.introduction),
    list,
  );
};

const renderPreparation = (): HTMLElement =>
  createSection(
    homeContent.preparation.title,
    createParagraph(homeContent.preparation.introduction),
    createList(homeContent.preparation.items),
    createParagraph(homeContent.preparation.note),
  );

const renderModules = (): HTMLElement => {
  const cards = document.createElement("div");
  cards.className = "module-cards";
  for (const module of modules) cards.append(renderModuleCard(module));
  return createSection(homeContent.modulesTitle, cards);
};

const renderReferences = (): HTMLElement => {
  const list = document.createElement("ul");
  for (const reference of homeContent.references.links) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = reference.href;
    link.textContent = reference.label;
    item.append(link, document.createTextNode(` — ${reference.description}`));
    list.append(item);
  }
  return createSection(
    homeContent.references.title,
    createParagraph(homeContent.references.introduction),
    list,
  );
};

export const renderHomePage = (): HTMLElement => {
  const page = document.createElement("div");
  page.className = "home-page";
  const main = document.createElement("main");
  main.append(
    renderHero(),
    renderAudience(),
    renderEvent(),
    renderLearningFlow(),
    renderPreparation(),
    renderModules(),
    renderReferences(),
  );
  page.append(renderSiteHeader(), main);
  return page;
};
