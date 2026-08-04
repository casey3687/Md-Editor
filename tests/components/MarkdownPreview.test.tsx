import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownPreview } from "../../src/features/preview/MarkdownPreview";
import styles from "../../src/features/preview/MarkdownPreview.module.css";

describe("MarkdownPreview", () => {
  it("renders tables, definition lists, superscript, subscript, line breaks, and code metadata", () => {
    const { container } = render(
      <MarkdownPreview
        content={`| Name | Value |
| --- | --- |
| One | 1 |

Term
: Definition

line one
line two

2^10^ and H~2~O<br />Next line

\`\`\`ts
const value = 1;
\`\`\``}
      />,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.querySelector("dl")).toBeInTheDocument();
    expect(container.querySelector("dt")?.textContent).toBe("Term");
    expect(container.querySelector("dd")?.textContent).toBe("Definition");
    expect(container.querySelector("sup")?.textContent).toBe("10");
    expect(container.querySelector("sub")?.textContent).toBe("2");
    expect(container.querySelectorAll("br").length).toBeGreaterThan(0);
    expect(container.querySelector('pre[data-code-block="true"]')).toBeInTheDocument();
    expect(container.querySelector(`.${styles.codeLanguage}`)?.textContent).toBe("ts");
  });

  it("does not render raw script elements from markdown html", () => {
    const { container } = render(<MarkdownPreview content={`Safe text<script>alert("xss")</script>`} />);

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("Safe text")).toBeInTheDocument();
  });

  it("keeps plus signs in fenced code language labels", () => {
    const { container } = render(
      <MarkdownPreview
        content={`\`\`\`c++
int main() {
  return 0;
}
\`\`\``}
      />,
    );

    expect(container.querySelector(`.${styles.codeLanguage}`)?.textContent).toBe("c++");
  });

  it("renders markdown images with responsive sizing", () => {
    render(<MarkdownPreview content="![diagram](diagram.png)" />);

    expect(screen.getByRole("img", { name: "diagram" })).toHaveClass(styles.responsiveImage);
  });

  it("copies fenced code block text from the preview and shows a temporary success toast", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <MarkdownPreview
          content={`\`\`\`ts
const value = 1;
console.log(value);
\`\`\``}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code block" }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(writeText).toHaveBeenCalledWith("const value = 1;\nconsole.log(value);");
      expect(screen.getByRole("status")).toHaveTextContent("复制成功");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the copy success toast on the first click even while clipboard is still pending", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => new Promise<void>(() => {}));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(
        <MarkdownPreview
          content={`\`\`\`ts
const value = 1;
\`\`\``}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Copy code block" }));

      expect(writeText).toHaveBeenCalledWith("const value = 1;");
      expect(screen.getByRole("status")).toHaveTextContent("复制成功");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a preview image class that constrains both width and height", () => {
    const css = readFileSync(resolve(process.cwd(), "src/features/preview/MarkdownPreview.module.css"), "utf8");

    expect(css).toContain("max-width: 100%");
    expect(css).toContain("max-height: calc(100vh - 14rem)");
  });
});
