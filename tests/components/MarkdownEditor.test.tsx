import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MarkdownEditor } from "../../src/features/editor/MarkdownEditor";

let lastCodeMirrorProps: { value: string; onChange: (value: string, viewUpdate: unknown) => void } | null = null;

vi.mock("@uiw/react-codemirror", () => ({
  default: (props: { value: string; onChange: (value: string, viewUpdate: unknown) => void }) => {
    lastCodeMirrorProps = props;
    return <div data-testid="codemirror" />;
  },
}));

describe("MarkdownEditor", () => {
  it("passes content through and forwards editor changes", () => {
    const onChange = vi.fn();

    render(<MarkdownEditor content="# Hello" onChange={onChange} />);

    expect(screen.getByTestId("codemirror")).toBeInTheDocument();
    expect(lastCodeMirrorProps?.value).toBe("# Hello");

    lastCodeMirrorProps?.onChange("# Updated", {});

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("# Updated", {});
  });
});
