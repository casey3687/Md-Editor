import { useEffect, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

import { markdownToWysiwygHtml, wysiwygHtmlToMarkdown } from "../../lib/markdown/wysiwyg";
import { openExternalUrl } from "../../lib/tauri/opener";
import styles from "./PreviewEditableSurface.module.css";

type PreviewEditableSurfaceProps = {
  content: string;
  documentPath?: string | null;
  onContentChange: (content: string) => void;
  jumpToLine?: number | null;
  jumpToken?: number | null;
  onScrollRatioChange?: (ratio: number) => void;
  onViewportLineChange?: (line: number) => void;
  onViewportRangeChange?: (startLine: number, endLine: number) => void;
  scrollRatio?: number;
  scrollToken?: number | null;
};

function getParentDirectory(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const normalized = path.replace(/\\/g, "/");
  const lastSlashIndex = normalized.lastIndexOf("/");
  if (lastSlashIndex < 0) {
    return null;
  }

  return normalized.slice(0, lastSlashIndex);
}

function resolveImageSource(source: string, documentPath?: string | null): string {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return trimmedSource;
  }

  if (/^(https?:|data:|blob:)/i.test(trimmedSource)) {
    return trimmedSource;
  }

  const hasTauriRuntime =
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in window;

  if (/^file:\/\//i.test(trimmedSource)) {
    const decodedPath = decodeURI(trimmedSource.replace(/^file:\/\//i, "").replace(/^\/+/, ""));
    if (hasTauriRuntime) {
      return convertFileSrc(decodedPath);
    }
    return trimmedSource;
  }

  if (/^[A-Za-z]:[\\/]/.test(trimmedSource)) {
    const normalizedPath = trimmedSource.replace(/\\/g, "/");
    if (hasTauriRuntime) {
      return convertFileSrc(normalizedPath);
    }
    return `file:///${encodeURI(normalizedPath)}`;
  }

  if (trimmedSource.startsWith("/")) {
    if (hasTauriRuntime) {
      return convertFileSrc(trimmedSource);
    }
    return trimmedSource;
  }

  const parentDirectory = getParentDirectory(documentPath ?? null);
  if (parentDirectory) {
    const resolvedPath = `${parentDirectory}/${trimmedSource}`.replace(/\/+/g, "/");
    if (hasTauriRuntime) {
      return convertFileSrc(resolvedPath);
    }
    return `file:///${encodeURI(resolvedPath)}`;
  }

  return trimmedSource;
}

function annotateCodeBlockLanguages(surface: HTMLElement) {
  surface.querySelectorAll<HTMLElement>("pre").forEach((preElement) => {
    const codeElement = preElement.querySelector<HTMLElement>("code");
    const languageClass = codeElement?.className ?? "";
    const matched = languageClass.match(/language-([a-z0-9_-]+)/i);

    if (!matched) {
      preElement.removeAttribute("data-language");
      return;
    }

    preElement.setAttribute("data-language", matched[1].toLowerCase());
  });
}

function hydrateInteractiveElements(surface: HTMLElement, documentPath?: string | null) {
  annotateCodeBlockLanguages(surface);
  surface.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.disabled = false;
    checkbox.setAttribute("contenteditable", "false");
  });

  surface.querySelectorAll<HTMLImageElement>("img").forEach((imageElement) => {
    const source = imageElement.getAttribute("src");
    if (!source) {
      return;
    }

    imageElement.setAttribute("src", resolveImageSource(source, documentPath));
    imageElement.setAttribute("loading", "lazy");
  });
}

function readHeadingAtLine(markdown: string, line: number): string | null {
  const lines = markdown.split(/\r?\n/);
  const source = lines[line - 1] ?? "";
  const match = source.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
  return match?.[1]?.trim() ?? null;
}

function escapeSelectorText(text: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(text);
  }

  return text.replace(/[\\"]/g, "\\$&");
}

export function PreviewEditableSurface({
  content,
  documentPath = null,
  onContentChange,
  jumpToLine = null,
  jumpToken = null,
  onScrollRatioChange,
  onViewportLineChange,
  onViewportRangeChange,
  scrollRatio = 0,
  scrollToken = null,
}: PreviewEditableSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const isEditingRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const viewportRafRef = useRef<number | null>(null);
  const lastRatioRef = useRef(-1);
  const lastLineRef = useRef(-1);
  const lastRangeRef = useRef<{ startLine: number; endLine: number } | null>(null);

  const syncMarkdownFromDom = () => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    hydrateInteractiveElements(surface, documentPath);
    onContentChange(wysiwygHtmlToMarkdown(surface.innerHTML));
  };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || isEditingRef.current) {
      return;
    }

    surface.innerHTML = markdownToWysiwygHtml(content);
    hydrateInteractiveElements(surface, documentPath);
    const headings = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"));
    const headingLines: number[] = [];
    const sourceLines = content.split(/\r?\n/);
    for (let index = 0; index < sourceLines.length; index += 1) {
      if (/^\s{0,3}#{1,6}\s+/.test(sourceLines[index])) {
        headingLines.push(index + 1);
      }
    }

    headings.forEach((heading, index) => {
      const line = headingLines[index];
      if (typeof line === "number") {
        heading.dataset.sourceLine = String(line);
      } else {
        heading.removeAttribute("data-source-line");
      }
    });

    if (viewportRafRef.current !== null) {
      window.cancelAnimationFrame(viewportRafRef.current);
    }
    viewportRafRef.current = window.requestAnimationFrame(() => {
      viewportRafRef.current = null;
      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      const ratio = maxScrollTop <= 0 ? 0 : surface.scrollTop / maxScrollTop;
      if (Math.abs(ratio - lastRatioRef.current) > 0.001) {
        lastRatioRef.current = ratio;
        onScrollRatioChange?.(ratio);
      }

      const headingElements = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
        heading.hasAttribute("data-source-line"),
      );

      if (headingElements.length === 0) {
        return;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const topEdge = surfaceRect.top + 8;
      const bottomEdge = surfaceRect.bottom - 8;
      const headingLinesInViewport: number[] = [];
      let activeLine = Number(headingElements[0].dataset.sourceLine ?? "1");

      headingElements.forEach((heading) => {
        const line = Number(heading.dataset.sourceLine ?? activeLine);
        const rect = heading.getBoundingClientRect();
        if (rect.top <= topEdge) {
          activeLine = line;
        }

        if (rect.bottom >= topEdge && rect.top <= bottomEdge) {
          headingLinesInViewport.push(line);
        }
      });

      if (headingLinesInViewport.length === 0) {
        headingLinesInViewport.push(activeLine);
      }

      const startLine = Math.min(activeLine, ...headingLinesInViewport);
      const endLine = Math.max(activeLine, ...headingLinesInViewport);

      if (
        !lastRangeRef.current ||
        lastRangeRef.current.startLine !== startLine ||
        lastRangeRef.current.endLine !== endLine
      ) {
        lastRangeRef.current = { startLine, endLine };
        onViewportRangeChange?.(startLine, endLine);
      }

      if (activeLine !== lastLineRef.current) {
        lastLineRef.current = activeLine;
        onViewportLineChange?.(activeLine);
      }
    });
  }, [content, documentPath, onScrollRatioChange, onViewportLineChange, onViewportRangeChange]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    const emitViewportState = () => {
      viewportRafRef.current = null;
      const headings = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
        heading.hasAttribute("data-source-line"),
      );

      if (headings.length === 0) {
        return;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const topEdge = surfaceRect.top + 8;
      const bottomEdge = surfaceRect.bottom - 8;
      const visibleLines: number[] = [];
      let activeLine = Number(headings[0].dataset.sourceLine ?? "1");

      headings.forEach((heading) => {
        const line = Number(heading.dataset.sourceLine ?? activeLine);
        const headingRect = heading.getBoundingClientRect();
        if (headingRect.top <= topEdge) {
          activeLine = line;
        }

        if (headingRect.bottom >= topEdge && headingRect.top <= bottomEdge) {
          visibleLines.push(line);
        }
      });

      if (visibleLines.length === 0) {
        visibleLines.push(activeLine);
      }

      const startLine = Math.min(activeLine, ...visibleLines);
      const endLine = Math.max(activeLine, ...visibleLines);
      if (
        !lastRangeRef.current ||
        lastRangeRef.current.startLine !== startLine ||
        lastRangeRef.current.endLine !== endLine
      ) {
        lastRangeRef.current = { startLine, endLine };
        onViewportRangeChange?.(startLine, endLine);
      }

      if (activeLine !== lastLineRef.current) {
        lastLineRef.current = activeLine;
        onViewportLineChange?.(activeLine);
      }
    };

    const scheduleViewportState = () => {
      if (viewportRafRef.current !== null) {
        return;
      }
      viewportRafRef.current = window.requestAnimationFrame(emitViewportState);
    };

    const handleScroll = () => {
      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      const ratio = maxScrollTop <= 0 ? 0 : surface.scrollTop / maxScrollTop;
      if (Math.abs(ratio - lastRatioRef.current) > 0.001) {
        lastRatioRef.current = ratio;
        onScrollRatioChange?.(ratio);
      }
      scheduleViewportState();
    };

    surface.addEventListener("scroll", handleScroll, { passive: true });
    scheduleViewportState();

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            scheduleViewportState();
          })
        : null;
    resizeObserver?.observe(surface);

    return () => {
      resizeObserver?.disconnect();
      surface.removeEventListener("scroll", handleScroll);
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
        viewportRafRef.current = null;
      }
    };
  }, [onScrollRatioChange, onViewportLineChange, onViewportRangeChange, content]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || scrollToken === null) {
      return;
    }

    const applyScroll = () => {
      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      surface.scrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop * scrollRatio));
    };

    applyScroll();
    const raf = window.requestAnimationFrame(applyScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [scrollRatio, scrollToken]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || jumpToLine === null || jumpToken === null) {
      return;
    }

    const targetByLine = surface.querySelector<HTMLElement>(`[data-source-line="${jumpToLine}"]`);
    if (targetByLine) {
      targetByLine.scrollIntoView({ block: "start", behavior: "smooth" });
      if (jumpToLine !== lastLineRef.current) {
        lastLineRef.current = jumpToLine;
        onViewportLineChange?.(jumpToLine);
      }
      return;
    }

    const headingText = readHeadingAtLine(content, jumpToLine);
    if (!headingText) {
      return;
    }

    const headingSelector = `h1,h2,h3,h4,h5,h6`;
    const headings = Array.from(surface.querySelectorAll<HTMLElement>(headingSelector));
    const target = headings.find((heading) => heading.textContent?.trim() === headingText);

    if (target) {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
      if (jumpToLine !== lastLineRef.current) {
        lastLineRef.current = jumpToLine;
        onViewportLineChange?.(jumpToLine);
      }
      return;
    }

    const fallback = surface.querySelector<HTMLElement>(`[id="${escapeSelectorText(headingText)}"]`);
    fallback?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (jumpToLine !== lastLineRef.current) {
      lastLineRef.current = jumpToLine;
      onViewportLineChange?.(jumpToLine);
    }
  }, [content, jumpToLine, jumpToken, onViewportLineChange]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={surfaceRef}
      className={styles.surface}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="WYSIWYG markdown editor"
      spellCheck
      onFocus={() => {
        isEditingRef.current = true;
      }}
      onBlur={() => {
        isEditingRef.current = false;
        syncMarkdownFromDom();
      }}
      onInput={() => {
        if (syncTimerRef.current !== null) {
          window.clearTimeout(syncTimerRef.current);
        }

        syncTimerRef.current = window.setTimeout(() => {
          syncMarkdownFromDom();
          syncTimerRef.current = null;
        }, 180);
      }}
      onClick={(event) => {
        const clickTarget = event.target;
        const targetElement =
          clickTarget instanceof Element ? clickTarget : clickTarget instanceof Node ? clickTarget.parentElement : null;
        if (!targetElement) {
          return;
        }

        const anchorElement = targetElement.closest<HTMLAnchorElement>("a[href]");
        if (anchorElement && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          event.stopPropagation();
          void Promise.resolve(openExternalUrl(anchorElement.href)).catch(() => {
            window.open(anchorElement.href, "_blank", "noopener,noreferrer");
          });
          return;
        }

        if (targetElement instanceof HTMLInputElement && targetElement.type === "checkbox") {
          window.setTimeout(() => {
            syncMarkdownFromDom();
          }, 0);
        }
      }}
    />
  );
}
