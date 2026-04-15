import { useEffect, useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";

import { MarkdownEditor } from "../../src/features/editor/MarkdownEditor";

let lastCodeMirrorProps:
  | {
      value: string;
      onChange: (value: string, viewUpdate: unknown) => void;
      height?: string;
      extensions?: unknown[];
      onCreateEditor?: (editorView: unknown) => void;
    }
  | null = null;
let delayScrollerRenderUntilMount = false;

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: {
    value: string;
    onChange: (value: string, viewUpdate: unknown) => void;
    height?: string;
    extensions?: unknown[];
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
        state: {
          doc: {
            lines: 500,
            lineAt: (position: number) => ({ number: Math.max(1, Math.ceil(position / 10)) }),
            line: (lineNumber: number) => ({ from: lineNumber }),
          },
        },
        dispatch: vi.fn(),
      });
    }, [props.onCreateEditor, ready]);

    return (
      <div ref={wrapperRef} data-testid="codemirror">
        {ready ? <div ref={scrollerRef} className="cm-scroller" data-testid="cm-scroller" /> : null}
      </div>
    );
  },
}));

describe("MarkdownEditor", () => {
  afterEach(() => {
    delayScrollerRenderUntilMount = false;
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
});
