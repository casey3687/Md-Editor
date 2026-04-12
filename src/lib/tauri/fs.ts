import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type { MarkdownFileEntry } from "../../types/editor";

type RawMarkdownFileEntry = {
  path: string;
  relative_path: string;
  name: string;
  directory_label: string;
  excerpt: string | null;
  modified_at: number | null;
};

export function isMarkdownFile(path: string) {
  return path.toLowerCase().endsWith(".md");
}

function normalizeDialogPath(path: string | string[] | null): string | null {
  if (typeof path === "string") {
    return path;
  }

  return null;
}

export function formatDirectoryLabel(directoryLabel: string | null | undefined) {
  const normalized = (directoryLabel ?? "").trim().replaceAll("\\", "/");
  return normalized.length > 0 ? normalized : ".";
}

function mapMarkdownFileEntry(entry: RawMarkdownFileEntry): MarkdownFileEntry {
  return {
    path: entry.path,
    relativePath: entry.relative_path,
    name: entry.name,
    directoryLabel: formatDirectoryLabel(entry.directory_label),
    excerpt: entry.excerpt,
    modifiedAt: entry.modified_at,
  };
}

export async function scanFolder(path: string) {
  const entries = await invoke<RawMarkdownFileEntry[]>("scan_folder", { path });
  return entries.map(mapMarkdownFileEntry);
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
