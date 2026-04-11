import { invoke } from "@tauri-apps/api/core";

import type { DirectoryNode } from "../../types/editor";

export function isMarkdownFile(path: string) {
  return path.toLowerCase().endsWith(".md");
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