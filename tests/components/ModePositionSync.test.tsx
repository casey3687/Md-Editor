import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";

type SurfaceProps = {
  jumpToLine?: number | null;
  jumpToken?: number | null;
  scrollToken?: number | null;
  onViewportLineChange?: (line: number) => void;
};

const { readMarkdownFile, getStartupArgs, setWindowTheme, setWindowTitle } = vi.hoisted(() => ({
  readMarkdownFile: vi.fn(),
  getStartupArgs: vi.fn(),
  setWindowTheme: vi.fn().mockResolvedValue(undefined),
  setWindowTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTheme: setWindowTheme,
    setTitle: setWindowTitle,
  }),
}));

vi.mock("../../src/lib/tauri/fs", () => ({
  scanFolder: vi.fn().mockResolvedValue([]),
  readMarkdownFile,
  saveMarkdownFile: vi.fn().mockResolvedValue(undefined),
  selectFolderPath: vi.fn().mockResolvedValue(null),
  selectMarkdownFilePath: vi.fn().mockResolvedValue(null),
  selectSaveMarkdownPath: vi.fn().mockResolvedValue(null),
  getStartupArgs,
  isMarkdownFile: (path: string) => path.endsWith(".md"),
}));

vi.mock("../../src/features/preview/PreviewEditableSurface", () => ({
  PreviewEditableSurface: ({ jumpToLine, jumpToken, scrollToken, onViewportLineChange }: SurfaceProps) => (
    <section
      aria-label="mock preview"
      data-jump-line={jumpToLine ?? ""}
      data-jump-token={jumpToken ?? ""}
      data-scroll-token={scrollToken ?? ""}
    >
      <button type="button" onClick={() => onViewportLineChange?.(42)}>
        Report preview line
      </button>
    </section>
  ),
}));

vi.mock("../../src/features/editor/MarkdownEditor", () => ({
  MarkdownEditor: ({ jumpToLine, jumpToken, scrollToken, onViewportLineChange }: SurfaceProps) => (
    <section
      aria-label="mock source"
      data-jump-line={jumpToLine ?? ""}
      data-jump-token={jumpToken ?? ""}
      data-scroll-token={scrollToken ?? ""}
    >
      <button type="button" onClick={() => onViewportLineChange?.(80)}>
        Report source line
      </button>
    </section>
  ),
}));

describe("mode position sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getStartupArgs.mockResolvedValue(["E:/notes/today.md"]);
    readMarkdownFile.mockResolvedValue("# Title\n\n## Middle\n\n## End");
  });

  it("uses the current viewport line as the jump target when switching modes", async () => {
    render(<App />);

    expect(await screen.findByLabelText("mock preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Report preview line" }));
    fireEvent.click(screen.getByRole("button", { name: "预览模式" }));

    const source = await screen.findByLabelText("mock source");
    expect(source).toHaveAttribute("data-jump-line", "42");
    expect(source.getAttribute("data-jump-token")).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Report source line" }));
    fireEvent.click(screen.getByRole("button", { name: "源码模式" }));

    await waitFor(() => {
      expect(screen.getByLabelText("mock preview")).toHaveAttribute("data-jump-line", "80");
    });
    expect(screen.getByLabelText("mock preview").getAttribute("data-jump-token")).not.toBe("");
  });

  it("does not send ratio restore token when a viewport line is available for mode switching", async () => {
    render(<App />);

    expect(await screen.findByLabelText("mock preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Report preview line" }));
    fireEvent.click(screen.getByRole("button", { name: "预览模式" }));

    const source = await screen.findByLabelText("mock source");
    expect(source).toHaveAttribute("data-jump-line", "42");
    expect(source).toHaveAttribute("data-scroll-token", "");
  });
});
