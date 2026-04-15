import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OutlinePanel } from "../../src/features/workspace/OutlinePanel";
import type { OutlineItem } from "../../src/types/editor";

function buildOutline(): OutlineItem[] {
  return [
    { id: "h1", text: "H1", level: 1, line: 1, anchor: "h1", isActive: false },
    { id: "h2", text: "H2", level: 2, line: 5, anchor: "h2", isActive: false },
    { id: "h3", text: "H3", level: 2, line: 9, anchor: "h3", isActive: false },
    { id: "h4", text: "H4", level: 2, line: 13, anchor: "h4", isActive: false },
    { id: "h5", text: "H5", level: 2, line: 17, anchor: "h5", isActive: false },
    { id: "h6", text: "H6", level: 2, line: 21, anchor: "h6", isActive: false },
  ];
}

describe("OutlinePanel", () => {
  it("keeps the viewport top heading near the top when the visible range is taller than the panel", async () => {
    const outline = buildOutline();
    const { container, rerender } = render(
      <OutlinePanel
        id="outline-panel"
        labelledBy="outline-tab"
        outline={outline}
        visibleOutlineIds={[]}
        onSelectOutline={() => undefined}
      />,
    );

    const nav = container.querySelector("nav");
    if (!nav) {
      throw new Error("Expected outline nav element.");
    }

    Object.defineProperty(nav, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(nav, "scrollTop", {
      configurable: true,
      writable: true,
      value: 300,
    });
    Object.defineProperty(nav, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          top: 260,
          bottom: 360,
          left: 0,
          right: 260,
          width: 260,
          height: 100,
          x: 0,
          y: 260,
          toJSON: () => ({}),
        }) satisfies DOMRect,
    });

    const buttonOffsets = [40, 120, 200, 280, 360, 500];
    const buttons = Array.from(container.querySelectorAll("button")).filter((button) =>
      ["H1", "H2", "H3", "H4", "H5", "H6"].includes(button.textContent ?? ""),
    );

    buttons.forEach((button, index) => {
      Object.defineProperty(button, "offsetTop", {
        configurable: true,
        value: buttonOffsets[index] + 260,
      });
      Object.defineProperty(button, "offsetHeight", {
        configurable: true,
        value: 28,
      });
      Object.defineProperty(button, "getBoundingClientRect", {
        configurable: true,
        value: () => {
          const top = 260 + buttonOffsets[index] - nav.scrollTop;
          return {
            top,
            bottom: top + 28,
            left: 0,
            right: 240,
            width: 240,
            height: 28,
            x: 0,
            y: top,
            toJSON: () => ({}),
          } satisfies DOMRect;
        },
      });
    });

    rerender(
      <OutlinePanel
        id="outline-panel"
        labelledBy="outline-tab"
        outline={outline}
        visibleOutlineIds={["h2", "h3", "h4", "h5", "h6"]}
        onSelectOutline={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(nav.scrollTop).toBe(110);
    });
  });
});
