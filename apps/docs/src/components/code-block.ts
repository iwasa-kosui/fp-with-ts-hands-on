export const renderCodeBlock = (heading: string, code: string, language: string): HTMLElement => {
  const figure = document.createElement("figure");
  figure.className = "code-block";

  const caption = document.createElement("figcaption");
  const title = document.createElement("span");
  title.className = "code-block__title";
  title.textContent = heading;
  const languageLabel = document.createElement("span");
  languageLabel.className = "code-block__language";
  languageLabel.textContent = language;
  caption.append(title, document.createTextNode(" "), languageLabel);

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.dataset.language = language;
  codeElement.textContent = code;
  pre.append(codeElement);

  figure.append(caption, pre);
  return figure;
};
