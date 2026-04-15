import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@tauri-apps")) {
            return "tauri";
          }

          if (id.includes("react-dom") || id.includes("/react/") || id.includes("scheduler")) {
            return "react-vendor";
          }

          if (id.includes("@uiw/react-codemirror")) {
            return "codemirror-ui";
          }

          if (id.includes("@codemirror/state") || id.includes("@codemirror/view")) {
            return "codemirror-core";
          }

          if (
            id.includes("@codemirror/lang-markdown") ||
            id.includes("@lezer/markdown")
          ) {
            return "codemirror-markdown";
          }

          if (
            id.includes("@codemirror/language") ||
            id.includes("@codemirror/search") ||
            id.includes("@codemirror/commands") ||
            id.includes("@codemirror/autocomplete") ||
            id.includes("@codemirror/lint") ||
            id.includes("@lezer/common") ||
            id.includes("@lezer/highlight")
          ) {
            return "codemirror-language";
          }

          if (id.includes("@codemirror") || id.includes("@lezer/")) {
            return "codemirror-misc";
          }

          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("rehype-") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("unist") ||
            id.includes("unified") ||
            id.includes("vfile")
          ) {
            return "markdown";
          }

          if (id.includes("katex")) {
            return "katex";
          }

          if (id.includes("zustand")) {
            return "state";
          }

          return undefined;
        },
      },
    },
  },
});
