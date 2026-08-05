import "./styles/base.css";
import { startApp } from "./app";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) {
  throw new Error("The #app root element is missing.");
}

startApp(root);
