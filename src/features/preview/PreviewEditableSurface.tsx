import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

import { collectPreviewBlocks } from "../../lib/markdown/previewEdit";
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

/** Minimum ms between a wheel event and a keystroke to treat a scroll as user-initiated. */
const USER_SCROLL_COOLDOWN_MS = 200;

type EditScrollLock = {
  scrollTop: number;
  scrollLeft: number;
  expiresAt: number;
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

function removeCodeBlockCopyButtons(surface: HTMLElement) {
  surface.querySelectorAll("[data-code-copy-button]").forEach((button) => button.remove());
}

function annotateCodeBlockLanguages(surface: HTMLElement) {
  surface.querySelectorAll<HTMLElement>("pre").forEach((preElement) => {
    const codeElement = preElement.querySelector<HTMLElement>("code");
    const languageClass = codeElement?.className ?? "";
    const matched = languageClass.match(/language-([a-z0-9_+#.-]+)/i);

    if (!matched) {
      preElement.removeAttribute("data-language");
    } else {
      preElement.setAttribute("data-language", matched[1].toLowerCase());
    }

    if (!preElement.querySelector("[data-code-copy-button]")) {
      const copyButton = document.createElement("button");
      copyButton.type = "button";
      copyButton.className = styles.copyCodeButton;
      copyButton.textContent = "\u590d\u5236";
      copyButton.setAttribute("aria-label", "Copy code block");
      copyButton.setAttribute("contenteditable", "false");
      copyButton.setAttribute("data-code-copy-button", "true");
      preElement.append(copyButton);
    }
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

function annotatePreviewSourceLines(surface: HTMLElement, content: string) {
  const blocks = collectPreviewBlocks(content).blocks.filter(
    (block, index, allBlocks) =>
      allBlocks.findIndex((candidate) => candidate.startOffset === block.startOffset) === index,
  );
  const elements = Array.from(surface.children) as HTMLElement[];

  elements.forEach((element, index) => {
    const block = blocks[index];
    if (!block) {
      element.removeAttribute("data-source-line");
      element.removeAttribute("data-source-end-line");
      return;
    }

    element.dataset.sourceLine = String(block.line);
    element.dataset.sourceEndLine = String(block.endLine);
  });

}

function readElementSourceLine(element: HTMLElement, fallback: number) {
  const line = Number(element.dataset.sourceLine);
  return Number.isFinite(line) && line > 0 ? line : fallback;
}

function getTopVisibleSourceLine(surface: HTMLElement): number | null {
  const sourceElements = Array.from(surface.querySelectorAll<HTMLElement>("[data-source-line]"));
  if (sourceElements.length === 0) {
    return null;
  }

  const surfaceRect = surface.getBoundingClientRect();
  const topEdge = surfaceRect.top + 8;
  const bottomEdge = surfaceRect.bottom - 8;
  let nearestBeforeTop = readElementSourceLine(sourceElements[0], 1);

  for (const element of sourceElements) {
    const line = readElementSourceLine(element, nearestBeforeTop);
    const rect = element.getBoundingClientRect();

    if (rect.top <= topEdge) {
      nearestBeforeTop = line;
    }

    if (rect.bottom >= topEdge && rect.top <= bottomEdge) {
      return line;
    }
  }

  return nearestBeforeTop;
}

function findSourceLineTarget(surface: HTMLElement, line: number): HTMLElement | null {
  const exact = surface.querySelector<HTMLElement>(`[data-source-line="${line}"]`);
  if (exact) {
    return exact;
  }

  const sourceElements = Array.from(surface.querySelectorAll<HTMLElement>("[data-source-line]"));
  return (
    sourceElements.find((element) => {
      const startLine = Number(element.dataset.sourceLine);
      const endLine = Number(element.dataset.sourceEndLine ?? element.dataset.sourceLine);
      return Number.isFinite(startLine) && Number.isFinite(endLine) && startLine <= line && line <= endLine;
    }) ?? null
  );
}

function getSelectionRangeInSurface(surface: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer ?? range.startContainer;
  if (!container) {
    return null;
  }

  const containerElement = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  return containerElement && surface.contains(containerElement) ? range : null;
}

function isRangeVisibleInSurface(range: Range, surface: HTMLElement) {
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.bottom === 0) {
    return true;
  }

  const surfaceRect = surface.getBoundingClientRect();
  return rect.bottom >= surfaceRect.top && rect.top <= surfaceRect.bottom;
}

function getRangeScrollTarget(range: Range, surface: HTMLElement): HTMLElement {
  const container = range.startContainer ?? range.commonAncestorContainer;
  const element = container?.nodeType === Node.ELEMENT_NODE ? (container as Element) : container?.parentElement;
  return element instanceof HTMLElement && surface.contains(element) ? element : surface;
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
  const lastJumpTokenRef = useRef<number | null>(null);
  const pendingJumpRef = useRef<{ line: number; token: number } | null>(null);
  const restoringScrollTokenRef = useRef<number | null>(null);
  const editScrollLockRef = useRef<EditScrollLock | null>(null);
  const editScrollRestoreFrameRef = useRef<number | null>(null);
  const pendingScrollRestoreRef = useRef<{ top: number; left: number } | null>(null);
  const userScrolledRef = useRef(false);
  const userScrollTimerRef = useRef<number | null>(null);
  const copyToastTimerRef = useRef<number | null>(null);
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  const showCopySuccessToast = () => {
    if (copyToastTimerRef.current !== null) {
      window.clearTimeout(copyToastTimerRef.current);
    }

    setCopyToastVisible(true);
    copyToastTimerRef.current = window.setTimeout(() => {
      copyToastTimerRef.current = null;
      setCopyToastVisible(false);
    }, 1000);
  };

  const copyCodeBlock = (button: HTMLElement) => {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    const preElement = button.closest("pre");
    const codeText = preElement?.querySelector("code")?.textContent?.replace(/\n$/, "") ?? "";
    showCopySuccessToast();
    void navigator.clipboard.writeText(codeText).catch(() => undefined);
  };

  const restoreLockedEditScroll = () => {
    const surface = surfaceRef.current;
    const lock = editScrollLockRef.current;
    if (!surface || !lock || !isEditingRef.current) {
      editScrollLockRef.current = null;
      return false;
    }

    if (Date.now() > lock.expiresAt) {
      editScrollLockRef.current = null;
      return false;
    }

    surface.scrollTop = lock.scrollTop;
    surface.scrollLeft = lock.scrollLeft;
    return true;
  };

  const scheduleEditScrollRestore = () => {
    if (editScrollRestoreFrameRef.current !== null) {
      return;
    }

    const tick = () => {
      editScrollRestoreFrameRef.current = null;
      if (!restoreLockedEditScroll()) {
        return;
      }

      editScrollRestoreFrameRef.current = window.requestAnimationFrame(tick);
    };

    editScrollRestoreFrameRef.current = window.requestAnimationFrame(tick);
  };

  const preserveVisibleEditScroll = () => {
    // The browser's contentEditable implementation may auto-scroll
    // to keep the caret visible after processing a keystroke. That
    // scroll sometimes fires a DOM scroll event, sometimes not.
    //
    // We use two detection paths in parallel:
    //   1. A one-shot "scroll" listener (works when the scroll fires an event)
    //   2. A double-rAF check (works when the scroll happens silently)
    //
    // We skip the correction if the user has recently wheel-scrolled
    // so we never fight an intentional scroll.

    const surface = surfaceRef.current;
    if (!surface || pendingScrollRestoreRef.current) {
      return;
    }

    const selectionRange = getSelectionRangeInSurface(surface);
    if (selectionRange && !isRangeVisibleInSurface(selectionRange, surface)) {
      getRangeScrollTarget(selectionRange, surface).scrollIntoView({ block: "nearest", behavior: "auto" });
      return;
    }

    if (userScrolledRef.current) {
      return;
    }

    const savedTop = surface.scrollTop;
    const savedLeft = surface.scrollLeft;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      surface.removeEventListener("scroll", onScroll);
      pendingScrollRestoreRef.current = null;
    };

    const restore = () => {
      cleanup();
      if (userScrolledRef.current) {
        return;
      }
      if (surface.scrollTop !== savedTop) {
        surface.scrollTop = savedTop;
      }
      if (surface.scrollLeft !== savedLeft) {
        surface.scrollLeft = savedLeft;
      }
    };

    const onScroll = () => {
      // The browser fired a scroll event — restore synchronously
      // before the frame paints.
      restore();
    };

    pendingScrollRestoreRef.current = { top: savedTop, left: savedLeft };
    surface.addEventListener("scroll", onScroll, { once: true });

    // Double-rAF fallback: catches silent scrolls that don't fire events.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (cleaned) {
          return;
        }
        // Only act if the scroll position actually drifted.
        // Otherwise keep the scroll-listener alive so it can catch
        // a late-arriving browser scroll.
        if (
          surface.scrollTop !== savedTop ||
          surface.scrollLeft !== savedLeft
        ) {
          restore();
        }
      });
    });

    // Absolute safety net
    window.setTimeout(cleanup, 250);
  };

  const handleSurfaceKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "PageUp" || event.key === "PageDown") {
      const surface = surfaceRef.current;
      if (!surface) {
        return;
      }

      event.preventDefault();
      userScrolledRef.current = true;
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
      }
      userScrollTimerRef.current = window.setTimeout(() => {
        userScrolledRef.current = false;
        userScrollTimerRef.current = null;
      }, USER_SCROLL_COOLDOWN_MS);

      const direction = event.key === "PageDown" ? 1 : -1;
      const maxScrollTop = Math.max(0, surface.scrollHeight - surface.clientHeight);
      const pageDistance = Math.max(1, Math.round(surface.clientHeight * 0.9));
      surface.scrollTop = Math.max(0, Math.min(maxScrollTop, surface.scrollTop + direction * pageDistance));
      return;
    }

    preserveVisibleEditScroll();
  };
  const syncMarkdownFromDom = () => {
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }

    hydrateInteractiveElements(surface, documentPath);
    const markdownSurface = surface.cloneNode(true) as HTMLElement;
    removeCodeBlockCopyButtons(markdownSurface);
    onContentChange(wysiwygHtmlToMarkdown(markdownSurface.innerHTML));
  };

  const shouldSuppressViewportLineForPendingJump = (line: number) => {
    const pendingJump = pendingJumpRef.current;
    if (!pendingJump || pendingJump.line === line) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || isEditingRef.current) {
      return;
    }

    surface.innerHTML = markdownToWysiwygHtml(content);
    hydrateInteractiveElements(surface, documentPath);
    annotatePreviewSourceLines(surface, content);

    if (viewportRafRef.current !== null) {
      window.cancelAnimationFrame(viewportRafRef.current);
    }
    viewportRafRef.current = window.requestAnimationFrame(() => {
      viewportRafRef.current = null;
      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      const ratio = maxScrollTop <= 0 ? 0 : surface.scrollTop / maxScrollTop;
      if (restoringScrollTokenRef.current === null && Math.abs(ratio - lastRatioRef.current) > 0.001) {
        lastRatioRef.current = ratio;
        onScrollRatioChange?.(ratio);
      }

      const topVisibleLine = getTopVisibleSourceLine(surface);
      const headingElements = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
        heading.hasAttribute("data-source-line"),
      );

      if (headingElements.length === 0) {
        if (topVisibleLine !== null && topVisibleLine !== lastLineRef.current) {
          if (shouldSuppressViewportLineForPendingJump(topVisibleLine)) {
            return;
          }
          lastLineRef.current = topVisibleLine;
          onViewportLineChange?.(topVisibleLine);
        }
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

      const viewportLine = topVisibleLine ?? activeLine;
      if (viewportLine !== lastLineRef.current) {
        if (shouldSuppressViewportLineForPendingJump(viewportLine)) {
          return;
        }
        lastLineRef.current = viewportLine;
        onViewportLineChange?.(viewportLine);
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
      const topVisibleLine = getTopVisibleSourceLine(surface);
      const headings = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")).filter((heading) =>
        heading.hasAttribute("data-source-line"),
      );

      if (headings.length === 0) {
        if (topVisibleLine !== null && topVisibleLine !== lastLineRef.current) {
          if (shouldSuppressViewportLineForPendingJump(topVisibleLine)) {
            return;
          }
          lastLineRef.current = topVisibleLine;
          onViewportLineChange?.(topVisibleLine);
        }
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

      const viewportLine = topVisibleLine ?? activeLine;
      if (viewportLine !== lastLineRef.current) {
        if (shouldSuppressViewportLineForPendingJump(viewportLine)) {
          return;
        }
        lastLineRef.current = viewportLine;
        onViewportLineChange?.(viewportLine);
      }
    };

    const scheduleViewportState = () => {
      if (viewportRafRef.current !== null) {
        return;
      }
      viewportRafRef.current = window.requestAnimationFrame(emitViewportState);
    };

    const handleScroll = () => {
      if (restoreLockedEditScroll()) {
        return;
      }

      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      const ratio = maxScrollTop <= 0 ? 0 : surface.scrollTop / maxScrollTop;
      if (restoringScrollTokenRef.current === null && Math.abs(ratio - lastRatioRef.current) > 0.001) {
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

    restoringScrollTokenRef.current = scrollToken;

    const applyScroll = () => {
      const maxScrollTop = surface.scrollHeight - surface.clientHeight;
      surface.scrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop * scrollRatio));
    };

    applyScroll();
    let releaseRaf: number | null = null;
    const restoreRaf = window.requestAnimationFrame(() => {
      applyScroll();
      releaseRaf = window.requestAnimationFrame(() => {
        if (restoringScrollTokenRef.current === scrollToken) {
          restoringScrollTokenRef.current = null;
          lastRatioRef.current = scrollRatio;
        }
      });
    });

    return () => {
      window.cancelAnimationFrame(restoreRaf);
      if (releaseRaf !== null) {
        window.cancelAnimationFrame(releaseRaf);
      }
      if (restoringScrollTokenRef.current === scrollToken) {
        restoringScrollTokenRef.current = null;
      }
    };
  }, [scrollRatio, scrollToken]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || jumpToLine === null || jumpToken === null) {
      return;
    }

    if (lastJumpTokenRef.current === jumpToken) {
      return;
    }
    lastJumpTokenRef.current = jumpToken;


    const targetByLine = findSourceLineTarget(surface, jumpToLine);
    if (targetByLine) {
      const targetLine = Number(targetByLine.dataset.sourceLine);
      const resolvedLine = Number.isFinite(targetLine) && targetLine > 0 ? targetLine : jumpToLine;
      pendingJumpRef.current = { line: resolvedLine, token: jumpToken };
      void targetByLine.offsetHeight; // force layout before scroll
      targetByLine.scrollIntoView({ block: "start", behavior: "auto" });
      window.requestAnimationFrame(() => {
        if (pendingJumpRef.current?.token === jumpToken) {
          pendingJumpRef.current = null;
        }
      });
      if (resolvedLine !== lastLineRef.current) {
        lastLineRef.current = resolvedLine;
        onViewportLineChange?.(resolvedLine);
      }
      return;
    }

    const headingText = readHeadingAtLine(content, jumpToLine);
    if (!headingText) {
      const sourceElements = Array.from(surface.querySelectorAll<HTMLElement>("[data-source-line]"));
      const nearestAfter = sourceElements.find((element) => {
        const line = Number(element.dataset.sourceLine);
        return Number.isFinite(line) && line >= jumpToLine;
      });
      if (nearestAfter) {
        const nearestLine = Number(nearestAfter.dataset.sourceLine);
        pendingJumpRef.current = { line: nearestLine, token: jumpToken };
        void nearestAfter.offsetHeight; // force layout before scroll
        nearestAfter.scrollIntoView({ block: "start", behavior: "auto" });
        window.requestAnimationFrame(() => {
          if (pendingJumpRef.current?.token === jumpToken) {
            pendingJumpRef.current = null;
          }
        });
        if (nearestLine !== lastLineRef.current) {
          lastLineRef.current = nearestLine;
          onViewportLineChange?.(nearestLine);
        }
        return;
      }
      // No block at or after the requested line — try the last block before it
      const nearestBefore = sourceElements.reduce<HTMLElement | null>((closest, element) => {
        const line = Number(element.dataset.sourceLine);
        if (!Number.isFinite(line) || line >= jumpToLine) {
          return closest;
        }
        if (!closest || line > Number(closest.dataset.sourceLine)) {
          return element;
        }
        return closest;
      }, null);
      if (nearestBefore) {
        const nearestLine = Number(nearestBefore.dataset.sourceLine);
        pendingJumpRef.current = { line: nearestLine, token: jumpToken };
        void nearestBefore.offsetHeight;
        nearestBefore.scrollIntoView({ block: "start", behavior: "auto" });
        window.requestAnimationFrame(() => {
          if (pendingJumpRef.current?.token === jumpToken) {
            pendingJumpRef.current = null;
          }
        });
        if (nearestLine !== lastLineRef.current) {
          lastLineRef.current = nearestLine;
          onViewportLineChange?.(nearestLine);
        }
        return;
      }
      return;
    }

    const headingSelector = `h1,h2,h3,h4,h5,h6`;
    const headings = Array.from(surface.querySelectorAll<HTMLElement>(headingSelector));
    const target = headings.find((heading) => heading.textContent?.trim() === headingText);

    if (target) {
      const targetLine = Number(target.dataset.sourceLine);
      const resolvedLine = Number.isFinite(targetLine) && targetLine > 0 ? targetLine : jumpToLine;
      pendingJumpRef.current = { line: resolvedLine, token: jumpToken };
      void target.offsetHeight; // force layout before scroll
      target.scrollIntoView({ block: "start", behavior: "auto" });
      window.requestAnimationFrame(() => {
        if (pendingJumpRef.current?.token === jumpToken) {
          pendingJumpRef.current = null;
        }
      });
      if (resolvedLine !== lastLineRef.current) {
        lastLineRef.current = resolvedLine;
        onViewportLineChange?.(resolvedLine);
      }
      return;
    }

    const fallback = surface.querySelector<HTMLElement>(`[id="${escapeSelectorText(headingText)}"]`);
    if (fallback) {
      const fallbackLine = Number(fallback.dataset.sourceLine);
      const resolvedLine = Number.isFinite(fallbackLine) && fallbackLine > 0 ? fallbackLine : jumpToLine;
      pendingJumpRef.current = { line: resolvedLine, token: jumpToken };
      void fallback.offsetHeight; // force layout before scroll
      fallback.scrollIntoView({ block: "start", behavior: "auto" });
    }
    window.requestAnimationFrame(() => {
      if (pendingJumpRef.current?.token === jumpToken) {
        pendingJumpRef.current = null;
      }
    });
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
      if (editScrollRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(editScrollRestoreFrameRef.current);
      }
      if (userScrollTimerRef.current !== null) {
        window.clearTimeout(userScrollTimerRef.current);
      }
      editScrollLockRef.current = null;
      restoringScrollTokenRef.current = null;
      pendingJumpRef.current = null;
      pendingScrollRestoreRef.current = null;
      if (copyToastTimerRef.current !== null) {
        window.clearTimeout(copyToastTimerRef.current);
      }
    };
  }, []);

  return (
    <>
      <div className={styles.surfaceHost}>
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
          onCompositionStart={preserveVisibleEditScroll}
          onBeforeInput={preserveVisibleEditScroll}
          onKeyDown={handleSurfaceKeyDown}
          onWheel={() => {
            userScrolledRef.current = true;
            if (userScrollTimerRef.current !== null) {
              window.clearTimeout(userScrollTimerRef.current);
            }
            userScrollTimerRef.current = window.setTimeout(() => {
              userScrolledRef.current = false;
              userScrollTimerRef.current = null;
            }, USER_SCROLL_COOLDOWN_MS);
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

            const copyButton = targetElement.closest<HTMLElement>("[data-code-copy-button]");
            if (copyButton) {
              event.preventDefault();
              event.stopPropagation();
              copyCodeBlock(copyButton);
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
      </div>
      {copyToastVisible ? (
        <div role="status" className={styles.copyToast}>
          {"\u590d\u5236\u6210\u529f"}
        </div>
      ) : null}
    </>
  );
}
