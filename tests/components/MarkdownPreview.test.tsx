import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownPreview } from "../../src/features/preview/MarkdownPreview";

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
    expect(container.querySelector('[data-code-block="true"]')?.previousElementSibling?.textContent).toBe("ts");
  });

  it("does not render raw script elements from markdown html", () => {
    const { container } = render(<MarkdownPreview content={`Safe text<script>alert("xss")</script>`} />);

    expect(container.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("Safe text")).toBeInTheDocument();
  });
});
