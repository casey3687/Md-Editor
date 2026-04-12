import type { OutlineItem } from "../../types/editor";
import styles from "./WorkspaceSidebar.module.css";

type OutlinePanelProps = {
  id: string;
  labelledBy: string;
  outline: OutlineItem[];
  onSelectOutline: (id: string) => void;
};

export function OutlinePanel({ id, labelledBy, outline, onSelectOutline }: OutlinePanelProps) {
  return (
    <section role="tabpanel" id={id} aria-labelledby={labelledBy} className={styles.panel} tabIndex={0}>
      {outline.length === 0 ? (
        <p className={styles.emptyState}>No headings found in the current document.</p>
      ) : (
        <nav aria-label="Document outline">
          <ul className={styles.list}>
            {outline.map((item) => {
              const indentLevel = Math.max(0, item.level - 1);

              return (
                <li key={item.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={`${styles.outlineButton} ${item.isActive ? styles.outlineButtonActive : ""}`}
                    aria-current={item.isActive ? "location" : undefined}
                    style={{ paddingInlineStart: `calc(0.875rem + ${indentLevel * 0.75}rem)` }}
                    onClick={() => onSelectOutline(item.id)}
                  >
                    {item.text}
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
