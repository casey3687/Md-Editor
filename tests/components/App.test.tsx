import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/app/App";
import { createEditorStore } from "../../src/store/editorStore";

const {
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
  setWindowTheme,
  setWindowTitle,
} = vi.hoisted(() => ({
  scanFolder: vi.fn(),
  readMarkdownFile: vi.fn(),
  saveMarkdownFile: vi.fn(),
  selectFolderPath: vi.fn(),
  selectMarkdownFilePath: vi.fn(),
  selectSaveMarkdownPath: vi.fn(),
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
  scanFolder,
  readMarkdownFile,
  saveMarkdownFile,
  selectFolderPath,
  selectMarkdownFilePath,
  selectSaveMarkdownPath,
  getStartupArgs,
  isMarkdownFile: (path: string) => path.endsWith(".md"),
}));

vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("does not show startup loading view when startup markdown file opens quickly", async () => {
    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/fast-file.md"]);
    readMarkdownFile.mockResolvedValue("# Loaded quickly");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Loaded quickly" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("status", { name: "正在加载中" })).not.toBeInTheDocument();
  });

  it("shows a startup loading view while opening a large startup markdown file", async () => {
    let resolveMarkdownRead: ((value: string) => void) | undefined;

    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/large-file.md"]);
    readMarkdownFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveMarkdownRead = resolve;
        }),
    );

    render(<App />);

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/large-file.md");
    });
    expect(screen.queryByRole("button", { name: "Open Folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "正在加载中" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status", { name: "正在加载中" })).toHaveTextContent("正在加载中......");

    expect(resolveMarkdownRead).toBeDefined();
    (resolveMarkdownRead as (value: string) => void)("# Loaded after delay");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Loaded after delay" })).toBeInTheDocument();
    });
  });

  it("shows loading view while opening a large file from welcome screen", async () => {
    let resolveMarkdownRead: ((value: string) => void) | undefined;

    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    selectMarkdownFilePath.mockResolvedValue("path/to/huge-file.md");
    readMarkdownFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveMarkdownRead = resolve;
        }),
    );

    render(<App />);
    screen.getByRole("button", { name: "Open File" }).click();

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/huge-file.md");
    });
    expect(screen.queryByRole("button", { name: "Open Folder" })).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "正在加载中" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status", { name: "正在加载中" })).toHaveTextContent("正在加载中......");

    expect(resolveMarkdownRead).toBeDefined();
    (resolveMarkdownRead as (value: string) => void)("# Huge loaded");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Huge loaded" })).toBeInTheDocument();
    });
  });

  it("switches away from welcome view before starting heavy file work", async () => {
    let resolveMarkdownRead: ((value: string) => void) | undefined;

    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    selectMarkdownFilePath.mockResolvedValue("path/to/heavy-file.md");
    readMarkdownFile.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveMarkdownRead = resolve;
        }),
    );

    render(<App />);
    screen.getByRole("button", { name: "Open File" }).click();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Open Folder" })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("status", { name: "正在加载中" })).not.toBeInTheDocument();
    expect(await screen.findByRole("status", { name: "正在加载中" })).toHaveTextContent("正在加载中......");

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/heavy-file.md");
    });
    expect(resolveMarkdownRead).toBeDefined();
    (resolveMarkdownRead as (value: string) => void)("# Opened after loading state");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Opened after loading state" })).toBeInTheDocument();
    });
  });

  it("opens a markdown file automatically if passed as a startup argument", async () => {
    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/my-file.md"]);
    readMarkdownFile.mockResolvedValue("# Hello from args");
    scanFolder.mockResolvedValue([]); // To avoid errors if it tries to load workspace

    render(<App />);

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/my-file.md");
    });
    
    // We expect the text editor to contain the loaded text
    // The wysiwyg editor content contains the parsed HTML
    await waitFor(() => {
        expect(screen.getByRole("textbox", { name: "WYSIWYG markdown editor" })).toBeInTheDocument();
    });
    
    expect(screen.getByRole("textbox", { name: "WYSIWYG markdown editor" }).innerHTML).toContain("Hello from args");
  });

  it("opens a renamed binary markdown file directly in the source editor", async () => {
    const decodedBinary = "PK\u0003\u0004\uFFFDworkbook";
    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/renamed-workbook.md"]);
    readMarkdownFile.mockResolvedValue(decodedBinary);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Markdown editor" })).toHaveValue(decodedBinary);
    });

    expect(screen.queryByRole("textbox", { name: "WYSIWYG markdown editor" })).not.toBeInTheDocument();
  });

  it("shows the outline tab by default when launched from a markdown file argument", async () => {
    getStartupArgs.mockResolvedValue(["path/to/app.exe", "path/to/my-file.md"]);
    readMarkdownFile.mockResolvedValue("# Hello from args\n\n## Details");

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Hello from args" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Outline" })).toHaveAttribute("aria-selected", "true");
    });
    expect(await screen.findByRole("button", { name: "Hello from args" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
  });

  it("opens the last opened large markdown file in source mode when launched without a file argument", async () => {
    const largeMarkdown = `# Hello from last session\n\n${"paragraph ".repeat(25000)}`;
    window.localStorage.setItem("md-editor.last-opened-file", "path/to/last-file.md");
    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    readMarkdownFile.mockResolvedValue(largeMarkdown);

    render(<App />);

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/last-file.md");
    });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Markdown editor" })).toHaveValue(largeMarkdown);
    });

    expect(screen.getByRole("button", { name: "源码模式" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "WYSIWYG markdown editor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开侧边栏" })).not.toBeInTheDocument();
  });

  it("falls back to the welcome view when the last opened file can no longer be read", async () => {
    window.localStorage.setItem("md-editor.last-opened-file", "path/to/missing-file.md");
    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    readMarkdownFile.mockRejectedValue(new Error("File not found"));

    render(<App />);

    await waitFor(() => {
      expect(readMarkdownFile).toHaveBeenCalledWith("path/to/missing-file.md");
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open Folder" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("md-editor.last-opened-file")).toBeNull();
  });

  it("opens very large markdown files in source mode by default", async () => {
    const largeMarkdown = `# Large file\n\n${"paragraph ".repeat(25000)}`;

    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    selectMarkdownFilePath.mockResolvedValue("path/to/large-file.md");
    readMarkdownFile.mockResolvedValue(largeMarkdown);

    render(<App />);
    screen.getByRole("button", { name: "Open File" }).click();

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Markdown editor" })).toHaveValue(largeMarkdown);
    });

    expect(screen.queryByRole("textbox", { name: "WYSIWYG markdown editor" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "源码模式" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "展开侧边栏" })).not.toBeInTheDocument();
  });

  it("shows saved status without waiting for a workspace rescan", async () => {
    const entry = {
      path: "C:/workspace/doc.md",
      relativePath: "doc.md",
      name: "doc.md",
      directoryLabel: ".",
      excerpt: null,
      modifiedAt: null,
    };

    getStartupArgs.mockResolvedValue(["path/to/app.exe"]);
    selectFolderPath.mockResolvedValue("C:/workspace");
    scanFolder
      .mockResolvedValueOnce([entry])
      .mockImplementationOnce(() => new Promise(() => undefined));
    readMarkdownFile.mockResolvedValue("# Doc");
    saveMarkdownFile.mockResolvedValue(undefined);

    render(<App />);
    screen.getByRole("button", { name: "Open Folder" }).click();

    await waitFor(() => {
      expect(screen.getByText("doc.md")).toBeInTheDocument();
    });

    screen.getByText("doc.md").closest("button")?.click();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Doc" })).toBeInTheDocument();
    });

    screen.getByRole("button", { name: "Save" }).click();

    await waitFor(() => {
      expect(saveMarkdownFile).toHaveBeenCalledWith("C:/workspace/doc.md", "# Doc");
      expect(screen.getByText("Saved doc.md")).toBeInTheDocument();
    });
  });
});
