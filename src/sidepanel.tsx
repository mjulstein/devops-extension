import { createRoot } from "react-dom/client";
import { App } from "./sidepanel/App";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app root element in side panel HTML.");
}

createRoot(container).render(<App />);
