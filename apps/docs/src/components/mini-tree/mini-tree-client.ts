export const setMiniTreeCurrent = (root: ParentNode, ids: readonly string[]): void => {
  root.querySelectorAll<HTMLElement>("[data-mini-file]").forEach((element) => {
    if (ids.includes(element.dataset.miniFile ?? "")) {
      element.setAttribute("data-current", "");
      element.setAttribute("aria-current", "true");
    } else {
      element.removeAttribute("data-current");
      element.removeAttribute("aria-current");
    }
  });
};
