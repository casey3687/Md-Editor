# Link Open + Source Wheel + Outline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three regressions: `Ctrl/Cmd + 左键` 链接在预览模式不能稳定打开外部浏览器、源码模式滚轮失效、预览滚动到底时大纲未同步显示当前可见区域末端标题。

**Architecture:** Keep the existing React + Tauri editor architecture, and apply targeted fixes in three chains: preview link-opening chain, CodeMirror wheel chain, and preview-to-outline viewport line chain. Add explicit TDD coverage first, then minimal implementation updates with no unrelated refactor.

**Tech Stack:** React 19 + TypeScript, Tauri 2, CodeMirror 6, Vitest + Testing Library.

---

### Task 1: Make Ctrl/Cmd + Click Always Open External Browser

**Files:**
- Create: `src/lib/tauri/opener.ts`
- Modify: `src/features/preview/PreviewEditableSurface.tsx`
- Modify: `package.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Test: `tests/components/PreviewEditableSurface.test.tsx`

- [ ] **Step 1: Write failing tests for Tauri opener path and fallback path**

```tsx
// tests/components/PreviewEditableSurface.test.tsx
vi.mock("../../src/lib/tauri/opener", () => ({
  openExternalUrl: vi.fn(),
}));

it("uses Tauri opener on Ctrl/Cmd + click", async () => {
  const { openExternalUrl } = await import("../../src/lib/tauri/opener");
  render(<PreviewEditableSurface content="[OpenAI](https://openai.com)" onContentChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("link", { name: "OpenAI" }), { ctrlKey: true });
  expect(openExternalUrl).toHaveBeenCalledWith("https://openai.com/");
});

it("falls back to window.open when Tauri opener throws", async () => {
  const { openExternalUrl } = await import("../../src/lib/tauri/opener");
  vi.mocked(openExternalUrl).mockRejectedValueOnce(new Error("mock opener failure"));
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

  render(<PreviewEditableSurface content="[OpenAI](https://openai.com)" onContentChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("link", { name: "OpenAI" }), { metaKey: true });

  await waitFor(() => expect(openSpy).toHaveBeenCalled());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/components/PreviewEditableSurface.test.tsx`  
Expected: FAIL because `openExternalUrl` module/calls do not exist yet.

- [ ] **Step 3: Implement minimal opener integration**

```ts
// src/lib/tauri/opener.ts
import { openUrl } from "@tauri-apps/plugin-opener";

export async function openExternalUrl(url: string): Promise<void> {
  await openUrl(url);
}
```

```tsx
// src/features/preview/PreviewEditableSurface.tsx (inside onClick)
const clickTarget = event.target;
const targetElement =
  clickTarget instanceof Element ? clickTarget : clickTarget instanceof Node ? clickTarget.parentElement : null;
if (!targetElement) return;

const anchorElement = targetElement.closest<HTMLAnchorElement>("a[href]");
if (anchorElement && (event.ctrlKey || event.metaKey)) {
  event.preventDefault();
  event.stopPropagation();
  void openExternalUrl(anchorElement.href).catch(() => {
    window.open(anchorElement.href, "_blank", "noopener,noreferrer");
  });
  return;
}
```

```toml
# src-tauri/Cargo.toml
tauri-plugin-opener = "2"
```

```rust
// src-tauri/src/lib.rs
.plugin(tauri_plugin_opener::init())
```

```json
// package.json (dependencies)
"@tauri-apps/plugin-opener": "^2.0.0"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/components/PreviewEditableSurface.test.tsx`  
Expected: PASS for link-opening cases.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tauri/opener.ts src/features/preview/PreviewEditableSurface.tsx src-tauri/Cargo.toml src-tauri/src/lib.rs package.json package-lock.json tests/components/PreviewEditableSurface.test.tsx
git commit -m "fix: open preview links via tauri opener on ctrl-click"
```

### Task 2: Fix Source Mode Mouse Wheel Scrolling Reliability

**Files:**
- Modify: `src/features/editor/MarkdownEditor.tsx`
- Test: `tests/components/MarkdownEditor.test.tsx`

- [ ] **Step 1: Add failing test for wheel handling with line/page delta modes**

```tsx
it("converts deltaMode line/page wheel events to pixel scrolling", async () => {
  render(<MarkdownEditor content={"# A\n\nB"} onChange={vi.fn()} />);
  const scroller = await screen.findByTestId("cm-scroller");
  Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 300 });
  Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1200 });
  Object.defineProperty(scroller, "scrollTop", { configurable: true, writable: true, value: 0 });

  fireEvent.wheel(screen.getByTestId("codemirror"), { deltaY: 3, deltaMode: 1 });
  expect(scroller.scrollTop).toBeGreaterThan(0);

  const beforePageScroll = scroller.scrollTop;
  fireEvent.wheel(screen.getByTestId("codemirror"), { deltaY: 1, deltaMode: 2 });
  expect(scroller.scrollTop).toBeGreaterThan(beforePageScroll);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/components/MarkdownEditor.test.tsx`  
Expected: FAIL because current wheel handling uses raw `deltaY` and does not normalize `deltaMode`.

- [ ] **Step 3: Implement robust wheel normalization + guarded preventDefault**

```ts
function wheelDeltaToPixels(event: WheelEvent, scroller: HTMLElement): number {
  const lineHeight = Number.parseFloat(window.getComputedStyle(scroller).lineHeight) || 18;
  if (event.deltaMode === 1) return event.deltaY * lineHeight;
  if (event.deltaMode === 2) return event.deltaY * scroller.clientHeight;
  return event.deltaY;
}

const handleWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey) return;
  const pixelDelta = wheelDeltaToPixels(event, scroller);
  if (Math.abs(pixelDelta) < 0.01) return;

  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
  if (maxScrollTop <= 0) return;

  const nextScrollTop = Math.max(0, Math.min(maxScrollTop, scroller.scrollTop + pixelDelta));
  if (nextScrollTop !== scroller.scrollTop) {
    scroller.scrollTop = nextScrollTop;
    event.preventDefault();
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/components/MarkdownEditor.test.tsx`  
Expected: PASS for delayed-scroller and deltaMode wheel tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/editor/MarkdownEditor.tsx tests/components/MarkdownEditor.test.tsx
git commit -m "fix: stabilize source-mode wheel scrolling in codemirror"
```

### Task 3: Keep Outline Synced with Visible Preview Range at Bottom

**Files:**
- Modify: `src/features/preview/PreviewEditableSurface.tsx`
- Modify: `src/app/App.tsx`
- Test: `tests/components/PreviewEditableSurface.test.tsx`
- Test: `tests/components/AppShell.test.tsx`

- [ ] **Step 1: Add failing test for bottom-of-preview active heading**

```tsx
it("reports the last visible heading line near preview bottom", () => {
  const onViewportLineChange = vi.fn();
  const content = `## 25\n\nx\n\n## 26\n\nx\n\n## 27\n\nx\n\n## 28\n\nx\n\n## 29\n\nx\n\n## 30\n\nx`;
  const { container } = render(
    <PreviewEditableSurface content={content} onContentChange={vi.fn()} onViewportLineChange={onViewportLineChange} />,
  );

  const surface = container.querySelector('[role="textbox"]') as HTMLDivElement;
  Object.defineProperty(surface, "clientHeight", { configurable: true, value: 300 });
  Object.defineProperty(surface, "scrollHeight", { configurable: true, value: 1800 });
  Object.defineProperty(surface, "scrollTop", { configurable: true, writable: true, value: 1500 });
  fireEvent.scroll(surface);

  expect(onViewportLineChange).toHaveBeenCalled();
  expect(onViewportLineChange.mock.calls.at(-1)?.[0]).toBeGreaterThanOrEqual(26);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/components/PreviewEditableSurface.test.tsx`  
Expected: FAIL because current active-line threshold uses near-top only and can stick at earlier heading.

- [ ] **Step 3: Implement viewport-aware heading selection**

```ts
// PreviewEditableSurface.tsx, in emitActiveHeading:
const probeLine = surface.scrollTop + Math.max(24, surface.clientHeight * 0.6);
let activeLine = Number(headings[0].dataset.sourceLine ?? "1");
for (const heading of headings) {
  if (heading.offsetTop <= probeLine) {
    activeLine = Number(heading.dataset.sourceLine ?? activeLine);
  } else {
    break;
  }
}
```

```ts
// App.tsx, keep existing setActiveOutline logic but add fallback:
if (!activeId) {
  activeId = outline.at(0)?.id ?? null;
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npm test -- --run tests/components/PreviewEditableSurface.test.tsx tests/components/AppShell.test.tsx`  
Expected: PASS and no outline navigation regressions.

- [ ] **Step 5: Commit**

```bash
git add src/features/preview/PreviewEditableSurface.tsx src/app/App.tsx tests/components/PreviewEditableSurface.test.tsx tests/components/AppShell.test.tsx
git commit -m "fix: sync outline with visible preview range near document end"
```

### Task 4: Final Verification Sweep

**Files:**
- Modify: none
- Test: full suite + build

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --run`  
Expected: all tests PASS.

- [ ] **Step 2: Run typecheck + build**

Run: `npm run build`  
Expected: typecheck PASS and vite build PASS.

- [ ] **Step 3: Smoke test in app**

Run: `npm run tauri dev`  
Expected:
- `Ctrl/Cmd + 左键` in preview opens default browser
- source mode mouse wheel scrolls normally after clicking outline
- when preview scrolls to bottom section range (e.g. 26-30), outline pane follows to bottom range

- [ ] **Step 4: Commit verification note**

```bash
git add -A
git commit -m "chore: verify link open, wheel scroll, and outline sync fixes"
```

## Plan Self-Review

- Spec coverage: all three user-reported regressions are mapped to dedicated tasks.
- Placeholder scan: no `TODO/TBD`, each code-touching step includes explicit snippets and commands.
- Type consistency: shared callback name remains `onViewportLineChange`; no renamed API mismatch introduced in the plan.
