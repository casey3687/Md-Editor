import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PreviewEditableSurface } from "../../src/features/preview/PreviewEditableSurface";

vi.mock("../../src/lib/tauri/opener", () => ({
  openExternalUrl: vi.fn(),
}));

describe("PreviewEditableSurface", () => {
  it("renders a full-document contenteditable WYSIWYG surface", () => {
    render(
      <PreviewEditableSurface
        content={`# Title

Plain paragraph.

\`\`\`ts
const value = 1;
\`\`\``}
        onContentChange={vi.fn()}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "WYSIWYG markdown editor" });
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute("contenteditable", "true");
    expect(editor.innerHTML).toContain("Title</h1>");
    expect(editor.querySelector("p")).toHaveTextContent("Plain paragraph.");
    expect(editor.innerHTML).toContain("const value = 1;");
  });

  it("syncs edited HTML content back to markdown on input/blur", () => {
    const onContentChange = vi.fn();

    render(<PreviewEditableSurface content={"# Title"} onContentChange={onContentChange} />);

    const editor = screen.getByRole("textbox", { name: "WYSIWYG markdown editor" });
    editor.innerHTML = "<h1>Updated title</h1><p>Body line</p>";
    fireEvent.input(editor);
    fireEvent.blur(editor);

    expect(onContentChange).toHaveBeenCalled();
    expect(onContentChange).toHaveBeenLastCalledWith(expect.stringContaining("# Updated title"));
    expect(onContentChange).toHaveBeenLastCalledWith(expect.stringContaining("Body line"));
  });

  it("uses tauri opener on Ctrl/Cmd + click", async () => {
    const { openExternalUrl } = await import("../../src/lib/tauri/opener");

    render(<PreviewEditableSurface content="[OpenAI](https://openai.com)" onContentChange={vi.fn()} />);

    const link = screen.getByRole("link", { name: "OpenAI" });
    fireEvent.click(link, { ctrlKey: true });

    expect(openExternalUrl).toHaveBeenCalledWith("https://openai.com/");
  });

  it("falls back to window.open when tauri opener fails", async () => {
    const { openExternalUrl } = await import("../../src/lib/tauri/opener");
    vi.mocked(openExternalUrl).mockRejectedValueOnce(new Error("mock opener failure"));

    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    try {
      render(<PreviewEditableSurface content="[OpenAI](https://openai.com)" onContentChange={vi.fn()} />);
      const link = screen.getByRole("link", { name: "OpenAI" });
      fireEvent.click(link, { metaKey: true });

      await waitFor(() => {
        expect(openSpy).toHaveBeenCalledWith("https://openai.com/", "_blank", "noopener,noreferrer");
      });
    } finally {
      openSpy.mockRestore();
    }
  });

  it("allows toggling task-list checkboxes directly in preview", async () => {
    const onContentChange = vi.fn();
    const { container } = render(<PreviewEditableSurface content="- [ ] todo" onContentChange={onContentChange} />);

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    expect(checkbox).not.toBeDisabled();

    fireEvent.click(checkbox as HTMLInputElement);

    await waitFor(() => {
      expect(onContentChange).toHaveBeenCalled();
    });
  });

  it("copies fenced code block text from the editable preview and shows a temporary success toast", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <PreviewEditableSurface
          content={`\`\`\`ts
const value = 1;
console.log(value);
\`\`\``}
          onContentChange={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code block" }));

      expect(writeText).toHaveBeenCalledWith("const value = 1;\nconsole.log(value);");
      expect(screen.getByRole("status")).toHaveTextContent("\u590d\u5236\u6210\u529f");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps plus signs in editable preview code language labels", () => {
    const { container } = render(
      <PreviewEditableSurface
        content={`\`\`\`c++
int main() {
  return 0;
}
\`\`\``}
        onContentChange={vi.fn()}
      />,
    );

    expect(container.querySelector("pre")?.getAttribute("data-language")).toBe("c++");
  });

  it("jumps to the heading at the exact source line even when heading text repeats", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: function mockScrollIntoView(this: HTMLElement) {
        this.setAttribute("data-scrolled", "true");
      },
    });

    try {
      const content = `# 文档

## 重名标题

正文

## 重名标题

更多正文`;

      const { container } = render(
        <PreviewEditableSurface content={content} onContentChange={vi.fn()} jumpToLine={7} jumpToken={1} />,
      );

      const duplicatedHeadings = container.querySelectorAll("h2");
      expect(duplicatedHeadings).toHaveLength(2);
      expect(duplicatedHeadings[0]).not.toHaveAttribute("data-scrolled", "true");
      expect(duplicatedHeadings[1]).toHaveAttribute("data-scrolled", "true");
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("keeps a line 1 source-to-preview jump anchored when the preview initially measures line 5", async () => {
    const onViewportLineChange = vi.fn();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const originalRequestAnimationFrame = window.requestAnimationFrame;
    const originalCancelAnimationFrame = window.cancelAnimationFrame;
    const animationCallbacks: FrameRequestCallback[] = [];
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    });
    window.cancelAnimationFrame = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    try {
      const content = `4.6 继承

说明

第五行`;

      const { container } = render(
        <PreviewEditableSurface
          content={content}
          onContentChange={vi.fn()}
          onViewportLineChange={onViewportLineChange}
          jumpToLine={1}
          jumpToken={1}
        />,
      );

      const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
      Object.defineProperty(surface, "clientHeight", { configurable: true, value: 300 });
      Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 900 });
      Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 120 });
      Object.defineProperty(surface, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({
            top: 100,
            bottom: 400,
            left: 0,
            right: 900,
            width: 900,
            height: 300,
            x: 0,
            y: 100,
            toJSON: () => ({}),
          }) satisfies DOMRect,
      });

      const blocks = Array.from(surface.children) as HTMLElement[];
      const blockTops = [0, 80, 120];
      blocks.forEach((block, index) => {
        Object.defineProperty(block, "getBoundingClientRect", {
          configurable: true,
          value: () => {
            const top = 100 + blockTops[index] - surface.scrollTop;
            return {
              top,
              bottom: top + 80,
              left: 0,
              right: 900,
              width: 900,
              height: 80,
              x: 0,
              y: top,
              toJSON: () => ({}),
            } satisfies DOMRect;
          },
        });
      });

      while (animationCallbacks.length > 0) {
        const callback = animationCallbacks.shift();
        callback?.(performance.now());
      }

      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(1);
    } finally {
      window.requestAnimationFrame = originalRequestAnimationFrame;
      window.cancelAnimationFrame = originalCancelAnimationFrame;
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("does not repeat an outline jump when focused preview content changes", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn(function mockScrollIntoView(this: HTMLElement) {
      this.setAttribute("data-scrolled", "true");
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });

    try {
      const initialContent = `# 文档

## 4.3.4 类做友元

但是你的卧室是私有的，也就是说只有你能进去

## 4.4 友元

正文`;

      const { container, rerender } = render(
        <PreviewEditableSurface
          content={initialContent}
          onContentChange={vi.fn()}
          jumpToLine={7}
          jumpToken={1}
        />,
      );

      const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
      fireEvent.focus(surface);

      expect(scrollIntoView).toHaveBeenCalledTimes(1);

      rerender(
        <PreviewEditableSurface
          content={initialContent.replace("只有你能进去", "只有你能进去ab")}
          onContentChange={vi.fn()}
          jumpToLine={7}
          jumpToken={1}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("reports top active heading and visible heading range while scrolling preview", async () => {
    const onViewportLineChange = vi.fn();
    const onViewportRangeChange = vi.fn();
    const content = `## 25

text

## 26

text

## 27

text

## 28

text

## 29

text

## 30

text`;
    const { container } = render(
      <PreviewEditableSurface
        content={content}
        onContentChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        onViewportRangeChange={onViewportRangeChange}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 400,
          left: 0,
          right: 900,
          width: 900,
          height: 300,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const headings = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"));
    headings.forEach((heading, index) => {
      Object.defineProperty(heading, "offsetTop", { configurable: true, value: index * 220 });
      Object.defineProperty(heading, "getBoundingClientRect", {
        configurable: true,
        value: () => {
          const top = 100 + index * 220 - surface.scrollTop;
          return {
            top,
            bottom: top + 32,
            left: 0,
            right: 900,
            width: 900,
            height: 32,
            x: 0,
            y: top,
            toJSON: () => ({}),
          } satisfies DOMRect;
        },
      });
    });

    fireEvent.scroll(surface);

    await waitFor(() => {
      expect(onViewportLineChange).toHaveBeenCalled();
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(17);
      expect(onViewportRangeChange).toHaveBeenCalledWith(17, 21);
    });
  });

  it("reports the top visible preview block line while scrolling preview", async () => {
    const onViewportLineChange = vi.fn();
    const content = `# Title

intro

plain paragraph at the top

## Next

body`;
    const { container } = render(
      <PreviewEditableSurface
        content={content}
        onContentChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1200 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 180 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 400,
          left: 0,
          right: 900,
          width: 900,
          height: 300,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const blocks = Array.from(surface.children) as HTMLElement[];
    const blockTops = [0, 80, 180, 420];
    blocks.forEach((block, index) => {
      Object.defineProperty(block, "getBoundingClientRect", {
        configurable: true,
        value: () => {
          const top = 100 + blockTops[index] - surface.scrollTop;
          return {
            top,
            bottom: top + 80,
            left: 0,
            right: 900,
            width: 900,
            height: 80,
            x: 0,
            y: top,
            toJSON: () => ({}),
          } satisfies DOMRect;
        },
      });
    });

    fireEvent.scroll(surface);

    await waitFor(() => {
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(5);
    });
  });

  it("does not report transient scroll ratios while restoring preview scroll", () => {
    const onScrollRatioChange = vi.fn();
    const { container } = render(
      <PreviewEditableSurface
        content="# Title"
        onContentChange={vi.fn()}
        onScrollRatioChange={onScrollRatioChange}
        scrollRatio={0.6}
        scrollToken={1}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 200 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 0 });

    onScrollRatioChange.mockClear();
    fireEvent.scroll(surface);

    expect(onScrollRatioChange).not.toHaveBeenCalled();
  });

  it("keeps the preview scroll position while focused editing content updates", () => {
    const { container, rerender } = render(
      <PreviewEditableSurface
        content={`# Before

## Current

text`}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 300 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });

    fireEvent.focus(surface);
    rerender(
      <PreviewEditableSurface
        content={`# Before

## Current

typed text`}
        onContentChange={vi.fn()}
      />,
    );

    expect(surface.scrollTop).toBe(900);
  });

  it("does not lock scroll when caret is visible so the user can scroll freely while typing", async () => {
    const getSelectionSpy = vi.spyOn(window, "getSelection");
    const { container } = render(
      <PreviewEditableSurface
        content={`# Before

## Current

text`}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 500,
          left: 0,
          right: 900,
          width: 900,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const range = {
      getBoundingClientRect: () =>
        ({
          top: 260,
          bottom: 280,
          left: 120,
          right: 140,
          width: 20,
          height: 20,
          x: 120,
          y: 260,
          toJSON: () => ({}),
        }) satisfies DOMRect,
      getClientRects: () => [] as unknown as DOMRectList,
    } as unknown as Range;
    getSelectionSpy.mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);

    try {
      fireEvent.focus(surface);
      fireEvent.keyDown(surface, { key: "a" });
      surface.scrollTop = 1100;

      await waitFor(() => {
        expect(surface.scrollTop).toBe(1100);
      });
    } finally {
      getSelectionSpy.mockRestore();
    }
  });

  it("does not lock scroll during IME composition when the surface is focused", async () => {
    const getSelectionSpy = vi.spyOn(window, "getSelection");
    const { container } = render(
      <PreviewEditableSurface
        content={`# Before

## Current

text`}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 500,
          left: 0,
          right: 900,
          width: 900,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const emptyRange = {
      getBoundingClientRect: () =>
        ({
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          width: 0,
          height: 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) satisfies DOMRect,
      getClientRects: () => [] as unknown as DOMRectList,
    } as unknown as Range;
    getSelectionSpy.mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => emptyRange,
    } as unknown as Selection);
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      value: surface,
    });

    try {
      fireEvent.focus(surface);
      fireEvent.compositionStart(surface);
      surface.scrollTop = 1100;

      await waitFor(() => {
        expect(surface.scrollTop).toBe(1100);
      });
    } finally {
      getSelectionSpy.mockRestore();
    }
  });

  it("corrects late-arriving browser auto-scroll after a keystroke", async () => {
    const getSelectionSpy = vi.spyOn(window, "getSelection");
    const { container } = render(
      <PreviewEditableSurface
        content={`# Before

## Current

text`}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 500,
          left: 0,
          right: 900,
          width: 900,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const range = {
      getBoundingClientRect: () =>
        ({
          top: 260,
          bottom: 280,
          left: 120,
          right: 140,
          width: 20,
          height: 20,
          x: 120,
          y: 260,
          toJSON: () => ({}),
        }) satisfies DOMRect,
      getClientRects: () => [] as unknown as DOMRectList,
    } as unknown as Range;
    getSelectionSpy.mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);

    try {
      fireEvent.focus(surface);
      fireEvent.keyDown(surface, { key: "a" });
      await act(async () => {
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => resolve());
            });
          });
        });
      });

      surface.scrollTop = 1100;
      fireEvent.scroll(surface);

      // The one-shot correction restores to the pre-keystroke position
      await waitFor(() => {
        expect(surface.scrollTop).toBe(900);
      });
    } finally {
      getSelectionSpy.mockRestore();
    }
  });

  it.each(["Backspace", "Delete", "Enter", "Tab", "ArrowLeft"] as const)(
    "corrects browser auto-scroll after %s keystroke",
    async (key) => {
      const getSelectionSpy = vi.spyOn(window, "getSelection");
      const { container } = render(
        <PreviewEditableSurface
          content={`# Before

## Current

text`}
          onContentChange={vi.fn()}
        />,
      );

      const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
      Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
      Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
      Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
      Object.defineProperty(surface, "getBoundingClientRect", {
        configurable: true,
        value: () =>
          ({
            top: 100,
            bottom: 500,
            left: 0,
            right: 900,
            width: 900,
            height: 400,
            x: 0,
            y: 100,
            toJSON: () => ({}),
          }) satisfies DOMRect,
      });

      const range = {
        getBoundingClientRect: () =>
          ({
            top: 260,
            bottom: 280,
            left: 120,
            right: 140,
            width: 20,
            height: 20,
            x: 120,
            y: 260,
            toJSON: () => ({}),
          }) satisfies DOMRect,
        getClientRects: () => [] as unknown as DOMRectList,
      } as unknown as Range;
      getSelectionSpy.mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => range,
      } as unknown as Selection);

      try {
        fireEvent.focus(surface);
        fireEvent.keyDown(surface, { key });
        surface.scrollTop = 1100;
        fireEvent.scroll(surface);

        // The one-shot correction restores to the pre-keystroke position
        await waitFor(() => {
          expect(surface.scrollTop).toBe(900);
        });
      } finally {
        getSelectionSpy.mockRestore();
      }
    },
  );

  it("scrolls back to the caret when typing after wheel-scrolling it out of view", async () => {
    const getSelectionSpy = vi.spyOn(window, "getSelection");
    const { container } = render(
      <PreviewEditableSurface
        content={`# Before

## Current

text`}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    const caretParagraph = surface.querySelector("p") as HTMLParagraphElement;
    const scrollIntoView = vi.fn();
    Object.defineProperty(caretParagraph, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 500,
          left: 0,
          right: 900,
          width: 900,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    // Caret is OUTSIDE the visible surface area — the user scrolled away
    const range = {
      getBoundingClientRect: () =>
        ({
          top: 600, // outside surface bottom (500)
          bottom: 620,
          left: 120,
          right: 140,
          width: 20,
          height: 20,
          x: 120,
          y: 600,
          toJSON: () => ({}),
        }) satisfies DOMRect,
      getClientRects: () => [] as unknown as DOMRectList,
      commonAncestorContainer: caretParagraph,
      startContainer: caretParagraph,
    } as unknown as Range;
    getSelectionSpy.mockReturnValue({
      rangeCount: 1,
      getRangeAt: () => range,
    } as unknown as Selection);

    try {
      fireEvent.focus(surface);
      fireEvent.wheel(surface, { deltaY: 600 });
      fireEvent.keyDown(surface, { key: "a" });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", behavior: "auto" });
    } finally {
      getSelectionSpy.mockRestore();
    }
  });

  it("uses viewport geometry to recover the top heading after scrolling from bottom to top", async () => {
    const onViewportLineChange = vi.fn();
    const onViewportRangeChange = vi.fn();
    const content = `## 1

text

## 2

text

## 3

text

## 4

text

## 5

text

## 6

text`;
    const { container } = render(
      <PreviewEditableSurface
        content={content}
        onContentChange={vi.fn()}
        onViewportLineChange={onViewportLineChange}
        onViewportRangeChange={onViewportRangeChange}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 2200 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 900 });
    Object.defineProperty(surface, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 100,
          bottom: 500,
          left: 0,
          right: 900,
          width: 900,
          height: 400,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const headingBases = [0, 220, 440, 660, 880, 1100];
    const headings = Array.from(surface.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6"));
    headings.forEach((heading, index) => {
      Object.defineProperty(heading, "getBoundingClientRect", {
        configurable: true,
        value: () => {
          const top = 100 + headingBases[index] - surface.scrollTop;
          return {
            top,
            bottom: top + 32,
            left: 0,
            right: 900,
            width: 900,
            height: 32,
            x: 0,
            y: top,
            toJSON: () => ({}),
          } satisfies DOMRect;
        },
      });
    });

    fireEvent.scroll(surface);
    await waitFor(() => {
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(17);
      expect(onViewportRangeChange.mock.calls.at(-1)).toEqual([17, 21]);
    });

    surface.scrollTop = 0;
    fireEvent.scroll(surface);

    await waitFor(() => {
      expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBe(1);
      expect(onViewportRangeChange.mock.calls.at(-1)).toEqual([1, 5]);
    });
  });
  it("scrolls the editor vertically for PageUp and PageDown without moving a code block horizontally", () => {
    const { container } = render(
      <PreviewEditableSurface
        content={"```ts\nconst veryLongValue = 'this line is deliberately wider than the code block';\n```"}
        onContentChange={vi.fn()}
      />,
    );

    const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
    const codeBlock = surface.querySelector("pre") as HTMLElement;
    Object.defineProperty(surface, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1600 });
    Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 400 });
    Object.defineProperty(codeBlock, "scrollLeft", { configurable: true, writable: true, value: 80 });

    expect(fireEvent.keyDown(codeBlock, { key: "PageDown" })).toBe(false);
    expect(surface.scrollTop).toBe(760);
    expect(codeBlock.scrollLeft).toBe(80);

    expect(fireEvent.keyDown(codeBlock, { key: "PageUp" })).toBe(false);
    expect(surface.scrollTop).toBe(400);
    expect(codeBlock.scrollLeft).toBe(80);
  });
});
