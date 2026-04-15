import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";

import styles from "./MarkdownEditor.module.css";

type MarkdownEditorProps = {
  content: string;
  onChange: (value: string) => void;
  jumpToLine?: number | null;
  jumpToken?: number | null;
  onScrollRatioChange?: (ratio: number) => void;
  onViewportLineChange?: (line: number) => void;
  onViewportRangeChange?: (startLine: number, endLine: number) => void;
  scrollRatio?: number;
  scrollToken?: number | null;
};

type WheelLikeEvent = WheelEvent & {
  wheelDelta?: number;
  detail?: number;
};

function wheelDeltaToPixels(event: WheelLikeEvent, scroller: HTMLElement): number {
  const rawDeltaY = Number(event.deltaY);
  let deltaY = Number.isFinite(rawDeltaY) ? rawDeltaY : 0;
  let deltaMode = Number.isFinite(event.deltaMode) ? event.deltaMode : 0;

  if (Math.abs(deltaY) < 0.01) {
    const legacyWheelDelta = Number(event.wheelDelta);
    if (Number.isFinite(legacyWheelDelta) && Math.abs(legacyWheelDelta) > 0.01) {
      deltaY = -legacyWheelDelta;
      deltaMode = 0;
    } else {
      const legacyDetail = Number(event.detail);
      if (Number.isFinite(legacyDetail) && Math.abs(legacyDetail) > 0.01) {
        deltaY = legacyDetail;
        deltaMode = 1;
      }
    }
  }

  const lineHeight = Number.parseFloat(window.getComputedStyle(scroller).lineHeight) || 18;
  if (deltaMode === 1) {
    return deltaY * lineHeight;
  }
  if (deltaMode === 2) {
    return deltaY * scroller.clientHeight;
  }
  return deltaY;
}

function shouldLogWheelDebug(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem("md-editor-wheel-debug") === "1";
  } catch {
    return false;
  }
}

export function MarkdownEditor({
  content,
  onChange,
  jumpToLine = null,
  jumpToken = null,
  onScrollRatioChange,
  onViewportLineChange,
  onViewportRangeChange,
  scrollRatio = 0,
  scrollToken = null,
}: MarkdownEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const lastViewportRef = useRef<{ topLine: number; bottomLine: number } | null>(null);
  const lastRatioRef = useRef<number | null>(null);

  useEffect(() => {
    const view = editorView;
    const scroller = view?.scrollDOM ?? null;
    const host = hostRef.current;
    if (!scroller || !view) {
      return;
    }

    const wheelDebugEnabled = shouldLogWheelDebug();
    const logWheelDebug = (message: string, payload: Record<string, unknown>) => {
      if (!wheelDebugEnabled) {
        return;
      }
      console.log(`[md-editor:wheel] ${message}`, payload);
    };

    logWheelDebug("listener-attached", {
      scrollerClass: scroller.className,
      clientHeight: scroller.clientHeight,
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      hostClientHeight: host?.clientHeight ?? null,
    });

    const clampScrollerHeight = () => {
      const hostHeight = host?.clientHeight ?? 0;
      if (hostHeight <= 0) {
        return;
      }

      scroller.style.height = `${hostHeight}px`;
      scroller.style.maxHeight = `${hostHeight}px`;
      scroller.style.minHeight = "0px";
      scroller.style.overflowY = "auto";

      logWheelDebug("scroller-height-clamped", {
        hostHeight,
        clientHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
      });
    };

    clampScrollerHeight();
    const resizeObserver =
      host && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            clampScrollerHeight();
          })
        : null;
    if (resizeObserver && host) {
      resizeObserver.observe(host);
    }

    const handleWheel = (event: Event) => {
      const wheelEvent = event as WheelLikeEvent;

      logWheelDebug("received", {
        type: event.type,
        deltaY: wheelEvent.deltaY,
        deltaMode: wheelEvent.deltaMode,
        wheelDelta: wheelEvent.wheelDelta,
        detail: wheelEvent.detail,
        scrollTop: scroller.scrollTop,
      });

      if (wheelEvent.ctrlKey || wheelEvent.metaKey) {
        return;
      }

      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      if (maxScrollTop <= 0) {
        logWheelDebug("ignored-no-overflow", {
          maxScrollTop,
          clientHeight: scroller.clientHeight,
          scrollHeight: scroller.scrollHeight,
          scrollTop: scroller.scrollTop,
          hostClientHeight: host?.clientHeight ?? null,
        });
        return;
      }

      const pixelDelta = wheelDeltaToPixels(wheelEvent, scroller);
      if (Math.abs(pixelDelta) < 0.01) {
        logWheelDebug("ignored-small-delta", { pixelDelta });
        return;
      }

      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scroller.scrollTop + pixelDelta));
      if (nextScrollTop !== scroller.scrollTop) {
        scroller.scrollTop = nextScrollTop;
        if (typeof wheelEvent.preventDefault === "function") {
          wheelEvent.preventDefault();
        }
        logWheelDebug("applied", { pixelDelta, nextScrollTop, maxScrollTop });
      }
    };

    const emitScrollState = () => {
      scrollFrameRef.current = null;
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      const ratio = maxScrollTop <= 0 ? 0 : scroller.scrollTop / maxScrollTop;
      if (lastRatioRef.current === null || Math.abs(lastRatioRef.current - ratio) > 0.001) {
        lastRatioRef.current = ratio;
        onScrollRatioChange?.(ratio);
      }

      const viewportFrom = Number(view.viewport.from) || 1;
      const viewportTo = Number(view.viewport.to) || viewportFrom;
      const bottomPosition = Math.max(viewportFrom, viewportTo - 1);
      const topLine = view.state.doc.lineAt(viewportFrom).number;
      const bottomLine = view.state.doc.lineAt(bottomPosition).number;

      if (
        !lastViewportRef.current ||
        lastViewportRef.current.topLine !== topLine ||
        lastViewportRef.current.bottomLine !== bottomLine
      ) {
        lastViewportRef.current = { topLine, bottomLine };
        onViewportLineChange?.(topLine);
        onViewportRangeChange?.(Math.min(topLine, bottomLine), Math.max(topLine, bottomLine));
      }
    };

    const scheduleScrollState = () => {
      if (scrollFrameRef.current !== null) {
        return;
      }
      scrollFrameRef.current = window.requestAnimationFrame(emitScrollState);
    };

    scroller.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    scroller.addEventListener("mousewheel", handleWheel, { capture: true, passive: false });
    scroller.addEventListener("DOMMouseScroll", handleWheel, { capture: true, passive: false });
    scroller.addEventListener("scroll", scheduleScrollState, { passive: true });
    scheduleScrollState();
    return () => {
      resizeObserver?.disconnect();
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      scroller.removeEventListener("wheel", handleWheel);
      scroller.removeEventListener("mousewheel", handleWheel);
      scroller.removeEventListener("DOMMouseScroll", handleWheel);
      scroller.removeEventListener("scroll", scheduleScrollState);
    };
  }, [editorView, onScrollRatioChange, onViewportLineChange, onViewportRangeChange, content]);

  useEffect(() => {
    const scroller = editorView?.scrollDOM ?? null;
    if (!scroller || scrollToken === null) {
      return;
    }

    const applyScroll = () => {
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop * scrollRatio));
    };

    applyScroll();
    const raf = window.requestAnimationFrame(applyScroll);
    return () => window.cancelAnimationFrame(raf);
  }, [editorView, scrollRatio, scrollToken]);

  useEffect(() => {
    if (!editorView || jumpToLine === null || jumpToken === null) {
      return;
    }

    const { state } = editorView;
    const boundedLine = Math.max(1, Math.min(jumpToLine, state.doc.lines));
    const targetLine = state.doc.line(boundedLine);
    editorView.dispatch({
      selection: { anchor: targetLine.from },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(targetLine.from, {
        y: "start",
        yMargin: 32,
      }),
    });
    onViewportLineChange?.(boundedLine);
  }, [editorView, jumpToLine, jumpToken, onViewportLineChange]);

  return (
    <div ref={hostRef} className={styles.editor}>
      <CodeMirror
        value={content}
        height="100%"
        extensions={[markdown()]}
        onChange={(value) => onChange(value)}
        onCreateEditor={(editorView) => {
          setEditorView(editorView);
        }}
      />
    </div>
  );
}
