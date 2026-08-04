import { useEffect, useRef, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { describe, expect, it, vi, afterEach } from "vitest";

import { MarkdownEditor } from "../../src/features/editor/MarkdownEditor";

let lastCodeMirrorProps:
  | {
      value: string;
      onChange: (value: string, viewUpdate: unknown) => void;
      height?: string;
      indentWithTab?: boolean;
      extensions?: unknown[];
      onCompositionStart?: () => void;
      onCompositionEnd?: () => void;
      onCreateEditor?: (editorView: unknown) => void;
    }
  | null = null;
let delayScrollerRenderUntilMount = false;
let mockEditorViewOverrides: Record<string, unknown> | null = null;

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: {
    value: string;
    onChange: (value: string, viewUpdate: unknown) => void;
    height?: string;
    indentWithTab?: boolean;
    extensions?: unknown[];
    onCompositionStart?: () => void;
    onCompositionEnd?: () => void;
    onCreateEditor?: (editorView: unknown) => void;
  }) => {
    const scrollerRef = useRef<HTMLDivElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const didCreateEditorRef = useRef(false);
    const [ready, setReady] = useState(!delayScrollerRenderUntilMount);

    lastCodeMirrorProps = props;

    useEffect(() => {
      if (!delayScrollerRenderUntilMount) {
        return;
      }

      setReady(true);
    }, []);

    useEffect(() => {
      if (!ready || !scrollerRef.current || !wrapperRef.current || didCreateEditorRef.current) {
        return;
      }

      didCreateEditorRef.current = true;

      props.onCreateEditor?.({
        scrollDOM: scrollerRef.current,
        viewport: { from: 1, to: 120 },
        documentTop: 0,
        state: {
          doc: {
            lines: 500,
            lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
            line: (lineNumber: number) => ({ from: lineNumber }),
          },
        },
        dispatch: vi.fn(),
        ...mockEditorViewOverrides,
      });
    }, [props.onCreateEditor, ready]);

    return (
      <div
        ref={wrapperRef}
        data-testid="codemirror"
        onCompositionStart={props.onCompositionStart}
        onCompositionEnd={props.onCompositionEnd}
      >
        {ready ? <div ref={scrollerRef} className="cm-scroller" data-testid="cm-scroller" /> : null}
      </div>
    );
  },
}));

describe("MarkdownEditor", () => {
  afterEach(() => {
    delayScrollerRenderUntilMount = false;
    mockEditorViewOverrides = null;
  });

  it("forwards wheel events to the source scroller", () => {
    const { container } = render(<MarkdownEditor content={"line1\nline2"} onChange={vi.fn()} />);
    const scroller = container.querySelector<HTMLElement>(".cm-scroller");
    expect(scroller).toBeTruthy();

    Object.defineProperty(scroller as HTMLElement, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(scroller as HTMLElement, "scrollHeight", { configurable: true, value: 1400 });
    Object.defineProperty(scroller as HTMLElement, "scrollTop", { configurable: true, writable: true, value: 0 });

    fireEvent.wheel(scroller as HTMLElement, { deltaY: 180 });

    expect((scroller as HTMLElement).scrollTop).toBeGreaterThan(0);
  });

  it("still supports wheel scrolling when the codemirror scroller appears after mount", async () => {
    delayScrollerRenderUntilMount = true;

    render(<MarkdownEditor content={"line1\nline2"} onChange={vi.fn()} />);

    const scroller = await screen.findByTestId("cm-scroller");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1400 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 0 });

    fireEvent.wheel(scroller, { deltaY: 180 });

    await waitFor(() => {
      expect(scroller.scrollTop).toBeGreaterThan(0);
    });
  });

  it("normalizes wheel deltaMode (line/page) into pixel scrolling", () => {
    render(<MarkdownEditor content={"# A\n\nB"} onChange={vi.fn()} />);

    const scroller = screen.getByTestId("cm-scroller");
    scroller.style.lineHeight = "20px";
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 0 });

    fireEvent.wheel(scroller, { deltaY: 3, deltaMode: 1 });
    expect(scroller.scrollTop).toBeGreaterThanOrEqual(60);

    const beforePageScroll = scroller.scrollTop;
    fireEvent.wheel(scroller, { deltaY: 1, deltaMode: 2 });
    expect(scroller.scrollTop - beforePageScroll).toBeGreaterThanOrEqual(300);
  });

  it("handles legacy mousewheel events that only expose wheelDelta", () => {
    render(<MarkdownEditor content={"# A\n\nB"} onChange={vi.fn()} />);

    const scroller = screen.getByTestId("cm-scroller");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 0 });

    const legacyWheelEvent = new Event("mousewheel", { bubbles: true, cancelable: true });
    Object.defineProperty(legacyWheelEvent, "wheelDelta", { configurable: true, value: -120 });
    scroller.dispatchEvent(legacyWheelEvent);

    expect(scroller.scrollTop).toBeGreaterThan(0);
  });

  it("reports top line and visible line range for outline sync", async () => {
    const onViewportLineChange = vi.fn();
    const onViewportRangeChange = vi.fn();
    render(
      <MarkdownEditor
        content={"# A\n\nB"}
        onChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        onViewportRangeChange={onViewportRangeChange}
      />,
    );

    await waitFor(() => {
      expect(onViewportLineChange).toHaveBeenCalled();
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(1);
      expect(onViewportRangeChange).toHaveBeenCalledWith(1, 12);
    });
  });

  it("reports the actual scrolled top line instead of CodeMirror rendered viewport buffer", async () => {
    const onViewportLineChange = vi.fn();
    const onViewportRangeChange = vi.fn();
    mockEditorViewOverrides = {
      viewport: { from: 100, to: 170 },
      documentTop: -450,
      lineBlockAtHeight: (height: number) => ({ from: height >= 450 ? 460 : 100 }),
      state: {
        doc: {
          lines: 500,
          lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
          line: (lineNumber: number) => ({ from: lineNumber }),
        },
      },
    };

    render(
      <MarkdownEditor
        content={"# doc"}
        onChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        onViewportRangeChange={onViewportRangeChange}
      />,
    );

    const scroller = screen.getByTestId("cm-scroller");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 2000 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 450 });

    fireEvent.scroll(scroller);

    await waitFor(() => {
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(46);
      expect(onViewportRangeChange.mock.calls.at(-1)?.[0]).toBe(46);
    });
  });

  it("keeps the source viewport near its current line on the first upward wheel after a mode jump", async () => {
    const onViewportLineChange = vi.fn();
    mockEditorViewOverrides = {
      viewport: { from: 900, to: 1100 },
      documentTop: -840,
      lineBlockAtHeight: (height: number) => ({ from: Math.round(height) }),
      state: {
        doc: {
          lines: 500,
          lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
          line: (lineNumber: number) => ({ from: lineNumber * 10 }),
        },
      },
    };

    render(
      <MarkdownEditor
        content={Array.from({ length: 500 }, (_, index) => `line ${index + 1}`).join("\n")}
        onChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
      />,
    );

    const scroller = screen.getByTestId("cm-scroller");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 5000 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 900 });
    vi.spyOn(scroller, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 100,
      top: 100,
      right: 800,
      bottom: 400,
      left: 0,
      width: 800,
      height: 300,
      toJSON: () => ({}),
    });

    fireEvent.wheel(scroller, { deltaY: -20 });

    await waitFor(() => {
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(94);
    });
    expect(scroller.scrollTop).toBe(880);
  });

  it("does not let an initial source viewport measurement override a programmatic line jump", async () => {
    const onViewportLineChange = vi.fn();
    const content = Array.from({ length: 130 }, (_, index) => `line ${index + 1}`).join("\n");
    mockEditorViewOverrides = {
      viewport: { from: 1, to: 120 },
      documentTop: 0,
      lineBlockAtHeight: () => ({ from: 90 }),
      state: {
        doc: {
          lines: 130,
          lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
          line: (lineNumber: number) => ({ from: lineNumber * 10 }),
        },
      },
    };

    render(
      <MarkdownEditor
        content={content}
        onChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        jumpToLine={120}
        jumpToken={1}
      />,
    );

    await waitFor(() => {
      expect(onViewportLineChange).toHaveBeenCalledWith(120);
    });

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(120);
  });

  it("does not let a late source viewport measurement override a completed programmatic line jump", async () => {
    const onViewportLineChange = vi.fn();
    const content = Array.from({ length: 500 }, (_, index) => `line ${index + 1}`).join("\n");
    mockEditorViewOverrides = {
      viewport: { from: 5543, to: 6572 },
      documentTop: 0,
      lineBlockAtHeight: () => ({ from: 100 }),
      state: {
        doc: {
          lines: 500,
          lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
          line: (lineNumber: number) => ({ from: lineNumber * 10 }),
        },
      },
    };

    render(
      <MarkdownEditor
        content={content}
        onChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        jumpToLine={444}
        jumpToken={1}
      />,
    );

    await waitFor(() => {
      expect(onViewportLineChange).toHaveBeenCalledWith(444);
    });

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    fireEvent.scroll(screen.getByTestId("cm-scroller"));

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(444);
  });

  it("does not repeat a line jump when typing updates content without a new jump token", async () => {
    const dispatch = vi.fn();
    mockEditorViewOverrides = {
      dispatch,
      state: {
        doc: {
          lines: 2,
          lineAt: (position: number) => ({ number: Math.max(1, position) }),
          line: (lineNumber: number) => ({ from: lineNumber }),
        },
      },
    };

    const { rerender } = render(
      <MarkdownEditor content={"# A"} onChange={vi.fn()} jumpToLine={1} jumpToken={1} />,
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledTimes(1);
    });

    rerender(<MarkdownEditor content={"# AB"} onChange={vi.fn()} jumpToLine={1} jumpToken={1} />);

    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("does not report transient scroll ratios while restoring source scroll", () => {
    const onScrollRatioChange = vi.fn();
    const { rerender } = render(
      <MarkdownEditor
        content={"# A\n\nB"}
        onChange={vi.fn()}
        onScrollRatioChange={onScrollRatioChange}
        scrollRatio={0}
        scrollToken={null}
      />,
    );

    const scroller = screen.getByTestId("cm-scroller");
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 0 });

    onScrollRatioChange.mockClear();
    rerender(
      <MarkdownEditor
        content={"# A\n\nB"}
        onChange={vi.fn()}
        onScrollRatioChange={onScrollRatioChange}
        scrollRatio={0.6}
        scrollToken={1}
      />,
    );
    fireEvent.scroll(scroller);

    expect(onScrollRatioChange).not.toHaveBeenCalled();
  });

  it("passes content through and forwards only the editor value", () => {
    const onChange = vi.fn();

    render(<MarkdownEditor content="# Hello" onChange={onChange} />);

    expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    expect(lastCodeMirrorProps?.value).toBe("# Hello");
    expect(lastCodeMirrorProps?.height).toBe("100%");
    expect(lastCodeMirrorProps?.extensions?.length).toBeGreaterThan(0);

    lastCodeMirrorProps?.onChange("# Updated", {});

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]).toEqual(["# Updated"]);
  });

  it("keeps Tab bound to editor indentation", () => {
    render(<MarkdownEditor content="# Hello" onChange={vi.fn()} />);

    expect(lastCodeMirrorProps?.indentWithTab).toBe(true);
  });

  it("wraps long source lines so the beginning of the next visual line stays visible", () => {
    render(<MarkdownEditor content={"A".repeat(200)} onChange={vi.fn()} />);

    expect(lastCodeMirrorProps?.extensions).toContain(EditorView.lineWrapping);
  });

  it("emits committed IME punctuation changes when no composition session is active", () => {
    const onChange = vi.fn();
    const composeTransaction = {
      isUserEvent: (eventName: string) => eventName === "input.type.compose",
    };

    render(<MarkdownEditor content="# Hello" onChange={onChange} />);

    act(() => {
      lastCodeMirrorProps?.onChange("# Hello，", {
        view: { composing: false, compositionStarted: false },
        transactions: [composeTransaction],
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("# Hello，");
  });
});
