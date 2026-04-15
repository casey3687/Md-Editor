import { useEffect, useEffectEvent } from "react";

function hasModifier(event: KeyboardEvent) {
  return (event.ctrlKey || event.metaKey) && !event.altKey;
}

function isToggleEditorModeShortcut(event: KeyboardEvent) {
  return hasModifier(event) && !event.shiftKey && (event.code === "Slash" || event.key === "/");
}

function isSaveShortcut(event: KeyboardEvent) {
  return hasModifier(event) && !event.shiftKey && event.key.toLowerCase() === "s";
}

function isSaveAsShortcut(event: KeyboardEvent) {
  return hasModifier(event) && event.shiftKey && event.key.toLowerCase() === "s";
}

function isNewFileShortcut(event: KeyboardEvent) {
  return hasModifier(event) && !event.shiftKey && event.key.toLowerCase() === "n";
}

function isOpenFileShortcut(event: KeyboardEvent) {
  return hasModifier(event) && !event.shiftKey && event.key.toLowerCase() === "o";
}

function isOpenFolderShortcut(event: KeyboardEvent) {
  return hasModifier(event) && event.shiftKey && event.key.toLowerCase() === "o";
}

function isInteractiveControl(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"]') !== null;
}

export interface EditorShortcutsHandlers {
  onToggleEditorMode: () => void;
  onNewFile: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
}

export function useEditorShortcuts(handlers: EditorShortcutsHandlers) {
  const handleKeyDownEvent = useEffectEvent((event: KeyboardEvent) => {
    const isControl = isInteractiveControl(event.target);

    if (isToggleEditorModeShortcut(event)) {
      if (!isControl) {
        event.preventDefault();
        handlers.onToggleEditorMode();
      }
      return;
    }

    if (isSaveAsShortcut(event)) {
      event.preventDefault();
      handlers.onSaveAs();
      return;
    }

    if (isSaveShortcut(event)) {
      event.preventDefault();
      handlers.onSave();
      return;
    }

    if (isNewFileShortcut(event)) {
      event.preventDefault();
      handlers.onNewFile();
      return;
    }

    if (isOpenFolderShortcut(event)) {
      event.preventDefault();
      handlers.onOpenFolder();
      return;
    }

    if (isOpenFileShortcut(event)) {
      event.preventDefault();
      handlers.onOpenFile();
      return;
    }
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyDownEvent(event);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
