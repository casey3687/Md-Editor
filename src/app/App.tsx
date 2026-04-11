import { AppShell } from "./AppShell";

export function App() {
  return (
    <AppShell
      workspacePath={null}
      hasActiveDocument={false}
      onNewFile={() => {}}
      onOpenFile={() => {}}
      onOpenFolder={() => {}}
      onSave={() => {}}
      onSaveAs={() => {}}
    />
  );
}
