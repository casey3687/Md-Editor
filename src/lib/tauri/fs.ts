import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { DirectoryNode } from "../../types/editor";

export function isMarkdownFile(path: string) {
  return path.toLowerCase().endsWith(".md");
}

function normalizeDialogPath(path: string | string[] | null): string | null {
  if (typeof path === "string") {
    return path;
  }

  return null;
}

export async function scanFolder(path: string) {
  return invoke<DirectoryNode[]>("scan_folder", { path });
}

export async function readMarkdownFile(path: string) {
  return invoke<string>("read_markdown_file", { path });
}

export async function saveMarkdownFile(path: string, content: string) {
  return invoke<void>("save_markdown_file", { path, content });
}

export async function selectFolderPath() {
  return normalizeDialogPath(
    await open({
      directory: true,
      multiple: false,
      title: "Open Folder",
    }),
  );
}

export async function selectMarkdownFilePath() {
  return normalizeDialogPath(
    await open({
      multiple: false,
      directory: false,
      title: "Open Markdown File",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    }),
  );
}

export async function selectSaveMarkdownPath(defaultPath?: string) {
  const selectedPath = await save({
    title: "Save Markdown File",
    defaultPath,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });

  if (!selectedPath) {
    return null;
  }

  return isMarkdownFile(selectedPath) ? selectedPath : `${selectedPath}.md`;
}
