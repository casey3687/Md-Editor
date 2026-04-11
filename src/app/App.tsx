import { useMemo } from "react";
import { useStore } from "zustand";

import { AppShell } from "./AppShell";
import { createEditorStore } from "../store/editorStore";

export function App() {
  const editorStore = useMemo(() => createEditorStore(), []);

  const workspacePath = useStore(editorStore, (state) => state.workspacePath);
  const hasActiveDocument = useStore(editorStore, (state) => state.activeDocument !== null);
  const isDirtyDocument = useStore(editorStore, (state) => state.activeDocument?.isDirty ?? false);
  const pendingNavigation = useStore(editorStore, (state) => state.pendingNavigation);

  const setPendingNavigation = editorStore.getState().setPendingNavigation;
  const clearPendingNavigation = () => setPendingNavigation(null);

  return (
    <AppShell
      workspacePath={workspacePath}
      hasActiveDocument={hasActiveDocument}
      isDirtyDocument={isDirtyDocument}
      pendingNavigation={pendingNavigation}
      onNewFile={() => {}}
      onOpenFile={() => {}}
      onOpenFolder={() => {}}
      onSave={() => {}}
      onSaveAs={() => {}}
      onPendingNavigationChange={setPendingNavigation}
      onSaveAndContinue={clearPendingNavigation}
      onDiscardChanges={clearPendingNavigation}
      onCancelNavigation={clearPendingNavigation}
    />
  );
}
