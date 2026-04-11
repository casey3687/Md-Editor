export type DirectoryNode = {
  path: string;
  name: string;
  kind: "directory" | "file";
  children?: DirectoryNode[];
};

export type EditorDocument = {
  path: string | null;
  name: string;
  content: string;
  isDirty: boolean;
};

export type PendingNavigation =
  | { type: "open-file"; path: string }
  | { type: "open-folder"; path: string }
  | { type: "new-file" }
  | null;