import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceSidebar } from "../../src/features/workspace/WorkspaceSidebar";
import type { OutlineItem, SidebarTab } from "../../src/types/editor";

describe("WorkspaceSidebar", () => {
  it("does not show the loaded workspace path above the sidebar tabs", () => {
    const workspacePath = "C:/Users/17956/Desktop/large-course-materials";

    render(
      <WorkspaceSidebar
        workspacePath={workspacePath}
        fileEntries={[]}
        sidebarTab="files"
        activePath={null}
        outline={[]}
        onSidebarTabChange={vi.fn()}
        onSelectFile={vi.fn()}
        onSelectOutline={vi.fn()}
      />,
    );

    expect(screen.queryByText(new RegExp(workspacePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).not.toBeInTheDocument();
  });

  it("renders file cards with relative directory labels and active state", () => {
    render(
      <WorkspaceSidebar
        workspacePath="docs"
        fileEntries={[
          {
            path: "docs/reports/today.md",
            relativePath: "reports/today.md",
            name: "today.md",
            directoryLabel: "reports",
            excerpt: null,
            modifiedAt: null,
          },
          {
            path: "docs/notes.md",
            relativePath: "notes.md",
            name: "notes.md",
            directoryLabel: ".",
            excerpt: null,
            modifiedAt: null,
          },
        ]}
        sidebarTab="files"
        activePath="docs/reports/today.md"
        outline={[]}
        onSidebarTabChange={vi.fn()}
        onSelectFile={vi.fn()}
        onSelectOutline={vi.fn()}
      />,
    );

    expect(screen.getByRole("tabpanel", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByText("reports")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /today\.md/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /notes\.md/i })).not.toHaveAttribute("aria-current");
  });

  it("renders outline headings in the outline tab and emits selection", () => {
    const onSelectOutline = vi.fn();
    const outline: OutlineItem[] = [
      { id: "intro", text: "Introduction", level: 1, line: 1, anchor: "introduction", isActive: false },
      { id: "usage", text: "Usage", level: 2, line: 8, anchor: "usage", isActive: true },
    ];

    render(
      <WorkspaceSidebar
        workspacePath="docs"
        fileEntries={[]}
        sidebarTab="outline"
        activePath={null}
        outline={outline}
        onSidebarTabChange={vi.fn()}
        onSelectFile={vi.fn()}
        onSelectOutline={onSelectOutline}
      />,
    );

    expect(screen.getByRole("tabpanel", { name: "Outline" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Introduction" }));

    expect(screen.getByRole("button", { name: "Usage" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("button", { name: "Usage" })).toHaveStyle("padding-inline-start: calc(0.75rem + 0.85rem)");
    expect(onSelectOutline).toHaveBeenCalledTimes(1);
    expect(onSelectOutline).toHaveBeenCalledWith("intro");
  });

  it("filters outline entries with the search field and supports clearing the query", () => {
    render(
      <WorkspaceSidebar
        workspacePath="docs"
        fileEntries={[]}
        sidebarTab="outline"
        activePath={null}
        outline={[
          { id: "intro", text: "Introduction", level: 1, line: 1, anchor: "introduction", isActive: false },
          { id: "usage", text: "Usage Guide", level: 1, line: 8, anchor: "usage-guide", isActive: false },
        ]}
        onSidebarTabChange={vi.fn()}
        onSelectFile={vi.fn()}
        onSelectOutline={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox", { name: "查找大纲" }), { target: { value: "usage" } });

    expect(screen.getByRole("button", { name: "Usage Guide" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Introduction" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清空搜索" }));

    expect(screen.getByRole("button", { name: "Introduction" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usage Guide" })).toBeInTheDocument();
  });

  it("supports keyboard tab navigation and empty states", () => {
    function Harness() {
      const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");

      return (
        <WorkspaceSidebar
          workspacePath="docs"
          fileEntries={[]}
          sidebarTab={sidebarTab}
          activePath={null}
          outline={[]}
          onSidebarTabChange={setSidebarTab}
          onSelectFile={vi.fn()}
          onSelectOutline={vi.fn()}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText("当前工作区没有发现 Markdown 文件。")).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Files" }), { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Outline" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("当前文档未发现标题。")).toBeInTheDocument();
  });

  it("switches between the files and outline panels", () => {
    function Harness() {
      const [sidebarTab, setSidebarTab] = useState<SidebarTab>("files");

      return (
        <WorkspaceSidebar
          workspacePath="docs"
          fileEntries={[
            {
              path: "docs/a.md",
              relativePath: "a.md",
              name: "a.md",
              directoryLabel: ".",
              excerpt: null,
              modifiedAt: null,
            },
          ]}
          sidebarTab={sidebarTab}
          activePath={null}
          outline={[
            { id: "intro", text: "Introduction", level: 1, line: 1, anchor: "introduction", isActive: false },
          ]}
          onSidebarTabChange={setSidebarTab}
          onSelectFile={vi.fn()}
          onSelectOutline={vi.fn()}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByRole("button", { name: /a\.md/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Outline" }));

    expect(screen.getByRole("button", { name: "Introduction" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /a\.md/i })).not.toBeInTheDocument();
  });

  it("collapses to a narrow rail and expands again", () => {
    function Harness() {
      const [isCollapsed, setIsCollapsed] = useState(false);

      return (
        <WorkspaceSidebar
          workspacePath="docs"
          fileEntries={[
            {
              path: "docs/a.md",
              relativePath: "a.md",
              name: "a.md",
              directoryLabel: ".",
              excerpt: null,
              modifiedAt: null,
            },
          ]}
          sidebarTab="files"
          activePath={null}
          outline={[]}
          isCollapsed={isCollapsed}
          onToggleCollapsed={() => setIsCollapsed((current) => !current)}
          onSidebarTabChange={vi.fn()}
          onSelectFile={vi.fn()}
          onSelectOutline={vi.fn()}
        />
      );
    }

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "收起侧边栏" }));

    expect(screen.getByRole("complementary", { name: "Workspace navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("tabpanel", { name: "Files" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开侧边栏" }));

    expect(screen.getByRole("tabpanel", { name: "Files" })).toBeInTheDocument();
  });
});
