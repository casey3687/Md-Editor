import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    expect(editor.innerHTML).toContain("<p>Plain paragraph.</p>");
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
});
