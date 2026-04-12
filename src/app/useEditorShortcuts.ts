import { useEffect, useEffectEvent } from "react";

function isToggleEditorModeShortcut(event: KeyboardEvent) {
  const hasToggleModifier = event.ctrlKey || event.metaKey;
  if (!hasToggleModifier || event.altKey) {
    return false;
  }

  return event.code === "Slash" || event.key === "/";
}

function isInteractiveControl(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest('button, a[href], [role="button"], [role="tab"], [role="menuitem"]') !== null;
}

type ToggleEditorMode = () => void;

export function useEditorShortcuts(toggleEditorMode: ToggleEditorMode) {
  const onToggleEditorMode = useEffectEvent(() => {
    toggleEditorMode();
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveControl(event.target)) {
        return;
      }

      if (!isToggleEditorModeShortcut(event)) {
        return;
      }

      event.preventDefault();
      onToggleEditorMode();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}
