export type EditorMode = "preview-edit" | "source";

export type SidebarTab = "files" | "outline";

export type MarkdownFileEntry = {
  path: string;
  relativePath: string;
  name: string;
  directoryLabel: string;
  excerpt: string | null;
  modifiedAt: number | null;
};

export type OutlineItem = {
  id: string;
  text: string;
  level: number;
  line: number;
  anchor: string;
  isActive: boolean;
};

export type EditorDocument = {
  path: string | null;
  name: string;
  content: string;
  isDirty: boolean;
  mode: EditorMode;
  outline: OutlineItem[];
};

export type DirectoryNode =
  | {
      path: string;
      name: string;
      kind: "file";
    }
  | {
      path: string;
      name: string;
      kind: "directory";
      children: DirectoryNode[];
    };

export type PendingNavigation =
  | { type: "open-file"; path: string }
  | { type: "open-folder"; path: string }
  | { type: "new-file" }
  | null;
