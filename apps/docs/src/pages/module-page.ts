import { renderContentBlock } from "../components/content-block";
import type { ModuleContent, ModuleTrigger } from "../content/module-content";
import { moduleNeighbors } from "../content/modules";
import { modulePath } from "../routes";

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

const assertNever = (value: never): never => {
  throw new Error(`Unsupported module trigger: ${JSON.stringify(value)}`);
};

const triggerHeading = (trigger: ModuleTrigger): string => {
  switch (trigger.kind) {
    case "incident":
      return "事故";
    case "new-requirement":
      return "新しい要求";
    case "review":
      return "レビュー要求";
    default:
      return assertNever(trigger);
  }
};

const triggerDetail = (trigger: ModuleTrigger): string => {
  switch (trigger.kind) {
    case "incident":
      return trigger.incident;
    case "new-requirement":
      return trigger.requirement;
    case "review":
      return trigger.reviewProblem;
    default:
      return assertNever(trigger);
  }
};

const renderSiteHeader = (): HTMLElement => {
  const header = document.createElement("header");
  header.className = "site-header";
  const navigation = document.createElement("nav");
  navigation.ariaLabel = "サイトナビゲーション";
  const home = document.createElement("a");
  home.href = "/";
  home.textContent = "トップへ";
  navigation.append(home);
  header.append(navigation);
  return header;
};

const renderHero = (module: ModuleContent): HTMLElement => {
  const hero = document.createElement("section");
  hero.className = "module-hero";
  const eyebrow = createParagraph(`${module.label} · ${module.durationMinutes}分`);
  eyebrow.className = "module-page__eyebrow";
  const title = document.createElement("h1");
  title.textContent = module.title;
  const caseStudy = createParagraph(
    `${module.caseStudy.avatar} ${module.caseStudy.animalName}（${module.caseStudy.animalType}） ${module.caseStudy.context}`,
  );
  hero.append(eyebrow, title, caseStudy);
  return hero;
};

const renderTrigger = (trigger: ModuleTrigger): HTMLElement => {
  const section = createSection(
    triggerHeading(trigger),
    createParagraph(trigger.situation),
    createParagraph(triggerDetail(trigger)),
  );
  section.dataset.trigger = "";
  return section;
};

const renderCommand = (
  title: string,
  command: string,
  expected: string,
  phase: "red" | "green",
): HTMLElement => {
  const commandBlock = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = command;
  commandBlock.append(code);

  const result = createParagraph(expected);
  const section = createSection(title, commandBlock, result);
  section.dataset.phase = phase;
  return section;
};

const renderEditTargets = (module: ModuleContent): HTMLElement => {
  const list = document.createElement("ul");
  for (const target of module.editTargets.slice(0, 2)) {
    const item = document.createElement("li");
    item.dataset.editTarget = "";
    const file = document.createElement("code");
    file.textContent = target.file;
    const symbol = document.createElement("code");
    symbol.textContent = target.symbol;
    item.append(file, document.createTextNode(" — "), symbol);
    list.append(item);
  }
  return createSection("編集対象", list);
};

const renderTechnique = (module: ModuleContent): HTMLElement => {
  const section = createSection(`使う技法: ${module.technique.name}`);
  const reasonHeading = document.createElement("h3");
  reasonHeading.textContent = "この技法を選ぶ理由";
  const limitsHeading = document.createElement("h3");
  limitsHeading.textContent = "この技法で解決しない範囲";
  section.append(
    reasonHeading,
    createParagraph(module.technique.reason),
    limitsHeading,
    createParagraph(module.technique.limits),
  );
  return section;
};

const renderFilesToRead = (module: ModuleContent): HTMLElement => {
  const list = document.createElement("ul");
  for (const entry of module.filesToRead) {
    const item = document.createElement("li");
    const file = document.createElement("code");
    file.textContent = entry.file;
    item.append(file, document.createTextNode(` — ${entry.focus}`));
    list.append(item);
  }
  return createSection("先に読むファイル", list);
};

const renderFallback = (module: ModuleContent): HTMLElement => {
  const examples = document.createElement("ul");
  for (const example of module.workedExamples) {
    const item = document.createElement("li");
    const file = document.createElement("code");
    file.textContent = example.file;
    item.append(file, document.createTextNode(` — ${example.symbols.join(", ")}`));
    examples.append(item);
  }
  return createSection("代替進行", createParagraph(module.fallbackGuidance), examples);
};

const renderResources = (module: ModuleContent): HTMLElement => {
  const list = document.createElement("ul");
  for (const resource of module.resources) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = resource.href;
    link.textContent = resource.label;
    item.append(link);
    list.append(item);
  }
  return createSection("参考リンク", list);
};

const renderActionPlan = (module: ModuleContent): HTMLElement | undefined => {
  const plan = module.finalActionPlan;
  if (plan === undefined) return undefined;

  const implementationLabel = document.createElement("label");
  implementationLabel.htmlFor = "implementation-location";
  implementationLabel.textContent = plan.implementationPrompt;
  const implementation = document.createElement("textarea");
  implementation.id = "implementation-location";
  implementation.name = "implementation-location";

  const firstActionLabel = document.createElement("label");
  firstActionLabel.htmlFor = "first-action";
  firstActionLabel.textContent = plan.firstActionPrompt;
  const firstAction = document.createElement("textarea");
  firstAction.id = "first-action";
  firstAction.name = "first-action";

  return createSection(
    "次の行動計画",
    implementationLabel,
    implementation,
    firstActionLabel,
    firstAction,
  );
};

const renderModuleNavigation = (module: ModuleContent): HTMLElement => {
  const navigation = document.createElement("nav");
  navigation.ariaLabel = "前後のモジュール";
  const { previous, next } = moduleNeighbors(module.slug);

  if (previous !== undefined) {
    const link = document.createElement("a");
    link.href = modulePath(previous);
    link.rel = "prev";
    link.textContent = `前へ: ${previous.title}`;
    navigation.append(link);
  }
  if (next !== undefined) {
    const link = document.createElement("a");
    link.href = modulePath(next);
    link.rel = "next";
    link.textContent = `次へ: ${next.title}`;
    navigation.append(link);
  }

  return navigation;
};

export const renderModulePage = (module: ModuleContent): HTMLElement => {
  const page = document.createElement("div");
  page.className = "module-page";
  const main = document.createElement("main");
  main.append(
    renderHero(module),
    renderTrigger(module.trigger),
    createSection("守る不変条件", createParagraph(module.invariant)),
    createSection("ミッション", createParagraph(module.mission)),
    renderCommand("Red: 失敗を確認する", module.red.command, module.red.expected, "red"),
    renderEditTargets(module),
    renderCommand("Green: 効果を確認する", module.green.command, module.green.expected, "green"),
    renderTechnique(module),
    renderFilesToRead(module),
  );

  for (const block of module.blocks) main.append(renderContentBlock(block));

  main.append(
    createSection("レビュー観点", createList(module.reviewPoints)),
    createSection("完了条件", createList(module.doneWhen)),
    createSection("業務への転用", createParagraph(module.changeImpact)),
    createSection("振り返り", createList(module.reflectionQuestions)),
    renderFallback(module),
    renderResources(module),
  );

  const actionPlan = renderActionPlan(module);
  if (actionPlan !== undefined) main.append(actionPlan);
  main.append(renderModuleNavigation(module));
  page.append(renderSiteHeader(), main);
  return page;
};
