import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/App";
import "katex/dist/katex.min.css";
import "./styles/global.css";

const APPEARANCE_STORAGE_KEY = "md-editor.appearance";

function getSavedAppearanceMode(): "light" | "dark" {
  try {
    return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

async function startApp() {
  const appearanceMode = getSavedAppearanceMode();
  document.documentElement.setAttribute("data-theme", appearanceMode);

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    const currentWindow = getCurrentWindow();
    await currentWindow.setTheme(appearanceMode);
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    await currentWindow.show();
    return;
  } catch {
    // The browser development server does not expose a Tauri window.
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void startApp();
