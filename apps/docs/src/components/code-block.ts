export const renderCodeBlock = (code: string, language: string): HTMLElement => {
  const figure = document.createElement("figure");
  figure.className = "code-block";

  const caption = document.createElement("figcaption");
  caption.textContent = language;

  const pre = document.createElement("pre");
  const codeElement = document.createElement("code");
  codeElement.textContent = code;
  pre.append(codeElement);

  figure.append(caption, pre);
  return figure;
};
