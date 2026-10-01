import "@fontsource-variable/shantell-sans/full.css";
import "@fontsource/andika/400.css";
import "@fontsource/andika/700.css";
import "@fontsource/patrick-hand/400.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
