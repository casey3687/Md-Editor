# Markdown Editor MVP Design

## Overview

This document defines the first shippable version of a desktop Markdown editor built with Tauri 2, React 19, TypeScript, Vite, CodeMirror 6, react-markdown, Zustand, and CSS Modules.

The MVP goal is a local-first editor that can open a folder, browse Markdown files through a directory tree, edit a single active Markdown document, render a live preview, and save changes back to disk. SQLite-backed recent files and settings are intentionally deferred to a later iteration.

## Scope

### In Scope

- Desktop shell built with Tauri 2
- React frontend with a three-pane layout
- Left directory tree for folders and `.md` files
- Middle Markdown source editor using CodeMirror 6
- Right live preview using `react-markdown`
- Open folder
- Open single Markdown file
- Create new Markdown document
- Save
- Save as
- Basic unsaved-change protection before destructive navigation
- Markdown preview support for headings, lists, code blocks, blockquotes, tables, links, and images

### Out of Scope

- SQLite integration
- Recent files
- Theme settings
- Font size settings
- Editor/preview layout customization
- Multi-tab editing
- Rename, delete, move, drag-and-drop, or search
- Auto-reopen previous workspace on launch

## User Experience

### Launch State

The app launches into a welcome state instead of restoring a previous workspace. The empty state presents two primary actions:

- Open Folder
- Open File

This keeps the MVP deterministic and avoids premature persistence requirements.

### Main Layout

After a folder or file is opened, the UI uses a fixed three-column layout:

- Left: directory tree
- Center: Markdown editor
- Right: rendered preview

If the user opens a single file without selecting a folder, the app still loads that document into the editor and preview. The directory tree area should remain usable, but may show a minimal state when no folder workspace exists.

### Editing Model

The MVP supports one active document at a time. This deliberately avoids tabs and split document state so file I/O, dirty tracking, and navigation prompts remain simple and reliable.

### Core Actions

- New: create an unsaved empty document labeled `Untitled.md`
- Open Folder: select a folder and load its directory tree
- Open File: select a Markdown file and load it as the active document
- Save: write changes back to the current path if one exists
- Save As: choose a new `.md` path and save there

### Unsaved Changes Protection

Before switching away from a dirty document by opening another file or workspace, the app shows a confirmation dialog with three actions:

- Save and continue
- Discard changes
- Cancel

The dialog is part of the MVP because preventing silent content loss is more important than advanced editor features.

## Architecture

The implementation uses a mixed local-desktop architecture:

- React components handle presentation and user interaction
- Zustand owns application and document state
- A frontend service layer wraps Tauri access behind stable functions
- Rust Tauri commands perform filesystem reads and writes
- Tauri dialog APIs may be used from the frontend for file and folder selection

This approach is preferred over an all-frontend filesystem model because it keeps local file logic centralized and creates a clean expansion point for future SQLite-backed metadata.

## Frontend Structure

The frontend should follow the existing project directories and keep responsibilities narrow.

### `src/app`

Contains the app shell, layout composition, and launch-state routing between the welcome view and the editor workspace.

### `src/features/file-tree`

Contains the directory tree UI, folder expansion state, file selection handlers, and tree-node presentation.

### `src/features/editor`

Contains the CodeMirror wrapper, editor extensions, content change handling, and active-document binding.

### `src/features/preview`

Contains the Markdown preview component and render configuration for `react-markdown`.

### `src/features/toolbar`

Contains the top-level actions for new, open, save, and save as.

### `src/store`

Contains the Zustand store and actions for workspace loading, document activation, content editing, dirty tracking, save flows, and error state.

### `src/lib/tauri`

Contains frontend-side wrappers for all Tauri command calls and dialog interactions. UI code should not call Tauri APIs directly.

### `src/lib/markdown`

Contains Markdown rendering helpers and plugin configuration for preview behavior.

### `src/types`

Contains shared TypeScript types for directory nodes, documents, store state, and command payloads.

## Rust Structure

### `src-tauri/src/commands/fs.rs`

Defines commands for:

- scanning a folder into a directory tree payload
- reading a Markdown file
- writing file contents
- creating a new file when saving an unsaved document

### `src-tauri/src/models.rs`

Defines serializable structs returned to the frontend, such as directory nodes and file payloads.

### `src-tauri/src/lib.rs`

Registers filesystem commands with Tauri.

### `src-tauri/capabilities`

Declares the required capabilities for local file access.

## Data Model

The frontend state should center on a small set of explicit models.

### Directory Node

A directory node represents one filesystem entry shown in the tree and should include:

- unique path
- display name
- node type (`directory` or `file`)
- child nodes for directories

Only directories and `.md` files should be included in the tree for the MVP.

### Document State

The active document state should include:

- optional file path
- display name
- current Markdown content
- dirty flag

Because the MVP is single-document only, the store does not need a tab collection.

### Workspace State

The workspace state should include:

- optional current folder path
- directory tree data
- active document
- loading state
- error message

## Data Flow

### Open Folder

1. The user triggers Open Folder from the welcome state or toolbar.
2. The frontend opens a system folder picker.
3. The selected folder path is passed to a Rust command.
4. Rust scans the folder recursively and returns a filtered directory tree containing directories and `.md` files only.
5. The Zustand store writes the workspace path and tree payload.
6. The file tree renders from store state.

### Open File

1. The user selects a file from the directory tree or the system file picker.
2. If the current document is dirty, the app runs the unsaved-changes confirmation flow first.
3. The frontend requests file contents through the service layer.
4. The store replaces the active document with the loaded file payload.
5. The editor and preview rerender from the active document.

### Edit Content

1. The user types into CodeMirror.
2. The editor emits content changes to the store.
3. The store updates document content and marks the document dirty.
4. The preview rerenders immediately using the same source content.

### Save

1. The user triggers Save.
2. If the active document already has a path, the frontend sends the content to the save command.
3. On success, the store clears the dirty flag.
4. On failure, the dirty flag remains true and the app surfaces an error message.

### Save As

1. The user triggers Save As.
2. The frontend opens a save dialog restricted to Markdown files.
3. The chosen path and content are sent to the save command.
4. On success, the store updates the document path and display name, clears the dirty flag, and refreshes the workspace tree if the file belongs to the open folder.

### New File

1. The user triggers New.
2. If the current document is dirty, the unsaved-changes confirmation flow runs first.
3. The store replaces the active document with an empty unsaved document named `Untitled.md`.
4. Save for this document routes through Save As until a path exists.

## Error Handling

The app should fail visibly but remain usable.

- Folder scan failure: show an error message and keep the previous document state intact
- File read failure: keep the existing document visible and report the failing path
- Save failure: preserve unsaved content, keep the dirty flag, and show the error
- Unsupported file selection: reject non-Markdown files from the app-controlled flows

Errors should surface in a consistent UI area, such as a top-level status bar or inline message region, rather than disappearing into the console.

## Markdown Rendering

Preview rendering should support common Markdown constructs required by the project brief:

- headings
- lists
- fenced code blocks
- blockquotes
- tables
- links
- images

The preview should render from the same in-memory document content used by the editor so the user sees live updates without needing to save.

## Testing Strategy

The MVP should focus tests on behaviors that protect correctness and user content.

### Frontend Unit Tests

- store transitions for open, edit, save, and dirty tracking
- directory tree adaptation logic
- Markdown rendering configuration

### Frontend Component Tests

- welcome state actions render correctly
- selecting a tree file activates the document flow
- dirty-document confirmation appears at the right time
- save button behavior follows document state

### Rust Tests

- folder scanning returns directories and `.md` files only
- file read returns expected contents
- file write persists expected contents

## Acceptance Criteria

The MVP is complete when all of the following are true:

- A user can launch the app and see a welcome state
- A user can open a folder and browse its Markdown files through a directory tree
- A user can open a Markdown file and see its source and rendered preview side by side
- A user can edit content and see the preview update in real time
- A user can create a new unsaved document
- A user can save an existing file
- A user can save a new document through Save As
- A user is warned before losing unsaved changes
- Core tests covering store behavior, component flows, and Rust filesystem commands pass

## Deferred Follow-Up

The next iteration should add:

- SQLite-backed recent files
- persisted settings for theme, font size, and pane layout
- optional last-workspace restore on startup

Those features should build on the same service and store boundaries defined in this document rather than introducing direct persistence calls from UI components.
