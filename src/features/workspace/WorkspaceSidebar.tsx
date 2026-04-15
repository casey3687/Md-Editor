import { useId, useRef, type KeyboardEvent } from "react";
import type { MarkdownFileEntry, OutlineItem, SidebarTab } from "../../types/editor";
import { FileListPanel } from "./FileListPanel";
import { OutlinePanel } from "./OutlinePanel";
import styles from "./WorkspaceSidebar.module.css";

type WorkspaceSidebarProps = {
  workspacePath: string | null;
  fileEntries: MarkdownFileEntry[];
  sidebarTab: SidebarTab;
  activePath: string | null;
  outline: OutlineItem[];
  visibleOutlineIds?: string[];
  onSidebarTabChange: (tab: SidebarTab) => void;
  onSelectFile: (path: string) => void;
  onSelectOutline: (id: string) => void;
};

export function WorkspaceSidebar({
  workspacePath,
  fileEntries,
  sidebarTab,
  activePath,
  outline,
  visibleOutlineIds = [],
  onSidebarTabChange,
  onSelectFile,
  onSelectOutline,
}: WorkspaceSidebarProps) {
  const filesTabId = useId();
  const outlineTabId = useId();
  const filesPanelId = useId();
  const outlinePanelId = useId();
  const filesTabRef = useRef<HTMLButtonElement>(null);
  const outlineTabRef = useRef<HTMLButtonElement>(null);

  const focusTab = (tab: SidebarTab) => {
    const target = tab === "files" ? filesTabRef.current : outlineTabRef.current;
    target?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: SidebarTab) => {
    const nextTab = (() => {
      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          return tab === "files" ? "outline" : "files";
        case "ArrowRight":
        case "ArrowDown":
          return tab === "files" ? "outline" : "files";
        case "Home":
          return "files";
        case "End":
          return "outline";
        default:
          return null;
      }
    })();

    if (!nextTab) {
      return;
    }

    event.preventDefault();
    onSidebarTabChange(nextTab);
    focusTab(nextTab);
  };

  return (
    <aside aria-label="Workspace navigation" className={styles.sidebar}>
      <p className={styles.workspaceLabel}>{workspacePath ? `已加载工作区：${workspacePath}` : "工作区就绪"}</p>
      <div role="tablist" aria-label="Sidebar tabs" className={styles.tabList}>
        <button
          type="button"
          aria-label="Files"
          role="tab"
          id={filesTabId}
          ref={filesTabRef}
          aria-selected={sidebarTab === "files"}
          aria-controls={filesPanelId}
          tabIndex={sidebarTab === "files" ? 0 : -1}
          className={`${styles.tab} ${sidebarTab === "files" ? styles.tabActive : ""}`}
          onKeyDown={(event) => handleTabKeyDown(event, "files")}
          onClick={() => onSidebarTabChange("files")}
        >
          文件
        </button>
        <button
          type="button"
          aria-label="Outline"
          role="tab"
          id={outlineTabId}
          ref={outlineTabRef}
          aria-selected={sidebarTab === "outline"}
          aria-controls={outlinePanelId}
          tabIndex={sidebarTab === "outline" ? 0 : -1}
          className={`${styles.tab} ${sidebarTab === "outline" ? styles.tabActive : ""}`}
          onKeyDown={(event) => handleTabKeyDown(event, "outline")}
          onClick={() => onSidebarTabChange("outline")}
        >
          大纲
        </button>
      </div>
      {sidebarTab === "files" ? (
        <FileListPanel
          id={filesPanelId}
          labelledBy={filesTabId}
          fileEntries={fileEntries}
          activePath={activePath}
          onSelectFile={onSelectFile}
        />
      ) : (
        <OutlinePanel
          id={outlinePanelId}
          labelledBy={outlineTabId}
          outline={outline}
          visibleOutlineIds={visibleOutlineIds}
          onSelectOutline={onSelectOutline}
        />
      )}
    </aside>
  );
}
