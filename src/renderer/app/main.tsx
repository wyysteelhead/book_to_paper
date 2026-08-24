import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import "../shared/styles/global.css";

window.addEventListener("error", (event) => {
  renderFatalError(event.error instanceof Error ? event.error : new Error(event.message));
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  renderFatalError(reason instanceof Error ? reason : new Error(String(reason)));
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

function renderFatalError(error: Error): void {
  const root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = `
    <main class="runtime-error-screen">
      <section>
        <p class="eyebrow">Runtime Error</p>
        <h1>页面运行时出错</h1>
        <p>${escapeHtml(error.message)}</p>
        <pre>${escapeHtml(error.stack ?? "")}</pre>
      </section>
    </main>
  `;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char];
  });
}
