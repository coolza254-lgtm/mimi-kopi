import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/noto-sans-thai";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/studio.css";
import "./styles/night.css";
import "./styles/interaction.css";
import "./styles/atelier.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
