import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { OutlineItem } from "../../types/editor";
import styles from "./WorkspaceSidebar.module.css";

type OutlinePanelProps = {
  id: string;
  labelledBy: string;
  outline: OutlineItem[];
  visibleOutlineIds?: string[];
  onSelectOutline: (id: string) => void;
};

export function OutlinePanel({ id, labelledBy, outline, visibleOutlineIds = [], onSelectOutline }: OutlinePanelProps) {
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const buttonRefMap = useRef<Map<string, HTMLButtonElement>>(new Map());
  const searchInputId = useId();
  const [query, setQuery] = useState("");
  const visibleOutlineSet = useMemo(() => new Set(visibleOutlineIds), [visibleOutlineIds]);

  const filteredOutline = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return outline;
    }

    return outline.filter((item) => item.text.toLowerCase().includes(normalizedQuery));
  }, [outline, query]);

  const topPriorityOutlineId = useMemo(() => {
    const topVisible = filteredOutline.find((item) => visibleOutlineSet.has(item.id));
    if (topVisible) {
      return topVisible.id;
    }

    return filteredOutline.find((item) => item.isActive)?.id ?? null;
  }, [filteredOutline, visibleOutlineSet]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) {
      return;
    }

    const targetButton =
      (topPriorityOutlineId ? buttonRefMap.current.get(topPriorityOutlineId) : null) ?? activeButtonRef.current;

    if (!targetButton) {
      return;
    }

    const margin = 10;
    const navRect = nav.getBoundingClientRect();
    const targetRect = targetButton.getBoundingClientRect();
    const relativeTop = targetRect.top - navRect.top;
    const relativeBottom = targetRect.bottom - navRect.top;
    const targetTop = Math.max(0, nav.scrollTop + relativeTop - margin);
    const targetBottom = nav.scrollTop + relativeBottom + margin;
    const viewTop = nav.scrollTop;
    const viewBottom = viewTop + nav.clientHeight;

    if (targetTop < viewTop || targetBottom > viewBottom) {
      nav.scrollTop = targetTop;
    }
  }, [filteredOutline, topPriorityOutlineId]);

  return (
    <section role="tabpanel" id={id} aria-labelledby={labelledBy} className={styles.panel} tabIndex={-1}>
      {outline.length === 0 ? (
        <p className={styles.emptyState}>当前文档未发现标题。</p>
      ) : (
        <>
          <div className={styles.outlineSearch}>
            <label htmlFor={searchInputId} className={styles.visuallyHidden}>
              查找大纲
            </label>
            <input
              id={searchInputId}
              type="search"
              aria-label="查找大纲"
              placeholder="查找"
              className={styles.searchInput}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              aria-label="清空搜索"
              className={styles.clearSearchButton}
              onClick={() => setQuery("")}
            >
              ×
            </button>
          </div>
          {filteredOutline.length === 0 ? <p className={styles.emptyState}>没有匹配的大纲项。</p> : null}
          <nav ref={navRef} aria-label="Document outline" className={styles.outlineNav}>
            <ul className={styles.outlineList}>
              {filteredOutline.map((item) => {
                const indentLevel = Math.max(0, item.level - 1);
                const isInViewport = visibleOutlineSet.has(item.id);

                return (
                  <li key={item.id} className={styles.outlineItem}>
                    <button
                      ref={(element) => {
                        if (element) {
                          buttonRefMap.current.set(item.id, element);
                        } else {
                          buttonRefMap.current.delete(item.id);
                        }

                        if (item.isActive) {
                          activeButtonRef.current = element;
                        }
                      }}
                      type="button"
                      className={`${styles.outlineButton} ${isInViewport ? styles.outlineButtonInViewport : ""} ${item.isActive ? styles.outlineButtonActive : ""}`}
                      aria-current={item.isActive ? "location" : undefined}
                      style={{ paddingInlineStart: `calc(0.75rem + ${indentLevel * 0.85}rem)` }}
                      onClick={() => onSelectOutline(item.id)}
                    >
                      {item.text}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
    </section>
  );
}
