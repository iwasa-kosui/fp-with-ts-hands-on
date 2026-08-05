import type { ContentBlock } from "../content/module-content";
import { renderCodeBlock } from "./code-block";

const heading = (text: string): HTMLHeadingElement => {
  const element = document.createElement("h2");
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
    listItem.append(title, document.createTextNode(item.description));
    list.append(listItem);
  }

  section.append(introduction, list);
  return section;
};

const assertNever = (value: never): never => {
  throw new Error(`Unsupported content block: ${JSON.stringify(value)}`);
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
    default:
      return assertNever(block);
  }
};
