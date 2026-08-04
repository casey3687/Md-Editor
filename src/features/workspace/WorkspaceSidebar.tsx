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
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
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
  isCollapsed = false,
  onToggleCollapsed,
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
    <aside
      aria-label="Workspace navigation"
      aria-expanded={!isCollapsed}
      className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ""}`}
    >
      {isCollapsed ? (
        onToggleCollapsed ? (
          <button
            type="button"
            aria-label="展开侧边栏"
            aria-expanded={!isCollapsed}
            className={styles.collapseButton}
            onClick={onToggleCollapsed}
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 5 L13 10 L8 15" />
            </svg>
          </button>
        ) : null
      ) : (
        <>
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
            {onToggleCollapsed ? (
              <button
                type="button"
                aria-label="收起侧边栏"
                aria-expanded={!isCollapsed}
                className={styles.collapseButton}
                onClick={onToggleCollapsed}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5 L7 10 L12 15" />
                </svg>
              </button>
            ) : null}
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
        </>
      )}
    </aside>
  );
}
