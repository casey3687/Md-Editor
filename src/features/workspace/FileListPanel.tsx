import type { MarkdownFileEntry } from "../../types/editor";
import styles from "./WorkspaceSidebar.module.css";

type FileListPanelProps = {
  id: string;
  labelledBy: string;
  fileEntries: MarkdownFileEntry[];
  activePath: string | null;
  onSelectFile: (path: string) => void;
};

export function FileListPanel({ id, labelledBy, fileEntries, activePath, onSelectFile }: FileListPanelProps) {
  return (
    <section role="tabpanel" id={id} aria-labelledby={labelledBy} className={styles.panel} tabIndex={-1}>
      {fileEntries.length === 0 ? (
        <p className={styles.emptyState}>当前工作区没有发现 Markdown 文件。</p>
      ) : (
        <nav aria-label="Markdown files">
          <ul className={styles.list}>
            {fileEntries.map((entry) => {
              const isActive = entry.path === activePath;

              return (
                <li key={entry.path} className={styles.listItem}>
                  <button
                    type="button"
                    className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => onSelectFile(entry.path)}
                  >
                    <span className={styles.cardName}>{entry.name}</span>
                    <span className={styles.cardDirectory}>{entry.directoryLabel}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </section>
  );
}
