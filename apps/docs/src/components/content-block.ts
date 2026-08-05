import type { ContentBlock, OnboardingChapter, OnboardingSection } from "../content/module-content";
import { renderCodeBlock } from "./code-block";

const heading = (text: string): HTMLHeadingElement => {
  const element = document.createElement("h2");
  element.textContent = text;
  return element;
};

const subheading = (text: string): HTMLHeadingElement => {
  const element = document.createElement("h3");
  element.textContent = text;
  return element;
};

const renderProse = (block: Extract<ContentBlock, { kind: "prose" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block prose-block";
  section.append(heading(block.heading));

  for (const paragraph of block.paragraphs) {
    const element = document.createElement("p");
    element.textContent = paragraph;
    section.append(element);
  }

  return section;
};

const renderCommandBlock = (block: Extract<ContentBlock, { kind: "command" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block command-block";
  section.dataset.phase = block.phase;
  section.append(heading(block.phase === "red" ? "Red" : "Green"));

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.textContent = block.command;
  pre.append(code);

  const expected = document.createElement("p");
  const label = document.createElement("strong");
  label.textContent = "期待結果: ";
  expected.append(label, document.createTextNode(block.expected));
  section.append(pre, expected);
  return section;
};

const renderFileTable = (block: Extract<ContentBlock, { kind: "file-table" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block file-table-block";
  section.append(heading(block.heading));

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["ファイル", "確認すること", "操作"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  head.append(headerRow);

  const body = document.createElement("tbody");
  for (const row of block.rows) {
    const tableRow = document.createElement("tr");
    const file = document.createElement("td");
    const fileName = document.createElement("code");
    fileName.textContent = row.file;
    file.append(fileName);
    const focus = document.createElement("td");
    focus.textContent = row.focus;
    const mode = document.createElement("td");
    mode.textContent = row.mode === "read" ? "読む" : "編集";
    tableRow.append(file, focus, mode);
    body.append(tableRow);
  }

  table.append(head, body);
  section.append(table);
  return section;
};

const renderChecklist = (block: Extract<ContentBlock, { kind: "checklist" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block checklist-block";
  section.append(heading(block.heading));

  const list = document.createElement("ul");
  for (const item of block.items) {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.append(listItem);
  }
  section.append(list);
  return section;
};

const renderOverview = (block: Extract<ContentBlock, { kind: "overview" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block overview-block";
  section.append(heading(block.heading));

  const introduction = document.createElement("p");
  introduction.textContent = block.introduction;

  const list = document.createElement("ul");
  for (const item of block.items) {
    const listItem = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = item.title;
    listItem.append(title, document.createTextNode(`: ${item.description}`));
    list.append(listItem);
  }

  section.append(introduction, list);
  return section;
};

const renderValueMap = (block: Extract<ContentBlock, { kind: "value-map" }>): HTMLElement => {
  const section = document.createElement("section");
  section.className = "content-block value-map-block";
  section.append(heading(block.heading));

  const introduction = document.createElement("p");
  introduction.textContent = block.introduction;

  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const label of ["機能", "届ける相手", "価値"]) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = label;
    headerRow.append(cell);
  }
  head.append(headerRow);

  const body = document.createElement("tbody");
  for (const row of block.rows) {
    const tableRow = document.createElement("tr");
    for (const value of [row.function, row.audiences, row.value]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    }
    body.append(tableRow);
  }

  table.append(head, body);
  section.append(introduction, table);
  return section;
};

const assertNever = (value: never): never => {
  throw new Error(`Unsupported content block: ${JSON.stringify(value)}`);
};

const renderOnboardingSection = (onboardingSection: OnboardingSection): HTMLElement => {
  const section = document.createElement("section");
  section.id = onboardingSection.id;
  section.append(subheading(onboardingSection.heading));

  switch (onboardingSection.kind) {
    case "business-context":
      for (const paragraph of onboardingSection.paragraphs) {
        const element = document.createElement("p");
        element.textContent = paragraph;
        section.append(element);
      }
      return section;
    case "visit-flow": {
      const introduction = document.createElement("p");
      introduction.textContent = onboardingSection.introduction;
      const steps = document.createElement("ol");
      for (const step of onboardingSection.steps) {
        const item = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = step.title;
        item.append(title, document.createTextNode(`: ${step.description}`));
        steps.append(item);
      }
      const people = document.createElement("section");
      people.id = onboardingSection.people.id;
      const peopleHeading = document.createElement("h4");
      peopleHeading.textContent = onboardingSection.people.heading;
      const peopleList = document.createElement("ul");
      for (const person of onboardingSection.people.items) {
        const item = document.createElement("li");
        const name = document.createElement("strong");
        name.textContent = person.name;
        item.append(name, document.createTextNode(`: ${person.description}`));
        peopleList.append(item);
      }
      people.append(peopleHeading, peopleList);
      section.append(introduction, steps, people);
      return section;
    }
    case "value-map": {
      const introduction = document.createElement("p");
      introduction.textContent = onboardingSection.introduction;
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      for (const label of ["機能", "利用者", "価値"]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headerRow.append(cell);
      }
      head.append(headerRow);
      const body = document.createElement("tbody");
      for (const row of onboardingSection.rows) {
        const tableRow = document.createElement("tr");
        for (const value of [row.function, row.audiences, row.value]) {
          const cell = document.createElement("td");
          cell.textContent = value;
          tableRow.append(cell);
        }
        body.append(tableRow);
      }
      table.append(head, body);
      section.append(introduction, table);
      return section;
    }
    case "visit-model": {
      const introduction = document.createElement("p");
      introduction.textContent = onboardingSection.introduction;
      const states = document.createElement("ul");
      for (const state of onboardingSection.states) {
        const item = document.createElement("li");
        const label = document.createElement("strong");
        label.textContent = state.label;
        const code = document.createElement("code");
        code.textContent = state.code;
        item.append(label, document.createTextNode(": "), code);
        states.append(item);
      }
      const rule = document.createElement("p");
      rule.textContent = onboardingSection.rule;
      section.append(introduction, states, rule);
      return section;
    }
    case "developer-guide": {
      const introduction = document.createElement("p");
      introduction.textContent = onboardingSection.introduction;
      const list = document.createElement("ul");
      for (const item of onboardingSection.items) {
        const listItem = document.createElement("li");
        const title = document.createElement("strong");
        title.textContent = item.title;
        listItem.append(title, document.createTextNode(`: ${item.description}`));
        list.append(listItem);
      }
      section.append(introduction, list);
      return section;
    }
    default:
      return assertNever(onboardingSection);
  }
};

export const renderOnboardingChapter = (chapter: OnboardingChapter): HTMLElement => {
  const section = document.createElement("section");
  section.id = chapter.id;
  section.className = "onboarding-chapter";
  section.append(heading(chapter.heading));
  for (const onboardingSection of chapter.sections) {
    section.append(renderOnboardingSection(onboardingSection));
  }
  return section;
};

export const renderContentBlock = (block: ContentBlock): HTMLElement => {
  switch (block.kind) {
    case "prose":
      return renderProse(block);
    case "code":
      return renderCodeBlock(block.heading, block.code, block.language);
    case "command":
      return renderCommandBlock(block);
    case "file-table":
      return renderFileTable(block);
    case "checklist":
      return renderChecklist(block);
    case "overview":
      return renderOverview(block);
    case "value-map":
      return renderValueMap(block);
    default:
      return assertNever(block);
  }
};
