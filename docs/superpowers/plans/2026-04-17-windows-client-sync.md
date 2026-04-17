# Windows Client Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cloud login, local SQLite sync metadata, document ID mapping, upload/download queue state, and conflict display to the existing Windows Tauri Markdown editor.

**Architecture:** Keep the existing React + Tauri structure. Add sync API wrappers under `src/lib/sync`, local SQLite metadata helpers under `src-tauri/src/commands/sync.rs`, and small Zustand additions for auth/session/sync queue state.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Zustand, CSS Modules, SQLite, Vitest + Testing Library.

---

### Task 1: Sync Types and Auth API Client

**Files:**
- Create: `src/types/sync.ts`
- Create: `src/lib/sync/http.ts`
- Create: `src/lib/sync/authApi.ts`
- Test: `tests/unit/lib/sync/authApi.test.ts`

- [ ] **Step 1: Write failing auth API test**

```ts
// tests/unit/lib/sync/authApi.test.ts
import { describe, expect, it, vi } from "vitest";

import { loginWithEmail } from "../../../../src/lib/sync/authApi";

describe("authApi", () => {
  it("posts email password login and returns token pair", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access.jwt",
        refresh_token: "refresh.token",
        expires_in_seconds: 900,
        user_id: "usr_1",
        device_id: "dev_1",
      }),
    });

    const result = await loginWithEmail(fetchMock, "http://localhost:7001", {
      email: "user@example.com",
      password: "correct horse battery staple",
      deviceName: "Windows PC",
      platform: "windows",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:7001/auth/login",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.accessToken).toBe("access.jwt");
    expect(result.deviceId).toBe("dev_1");
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- --run tests/unit/lib/sync/authApi.test.ts`  
Expected: FAIL because `authApi` does not exist.

- [ ] **Step 3: Add sync types and HTTP helper**

```ts
// src/types/sync.ts
export type Platform = "windows" | "android" | "ios";

export type LoginInput = {
  email: string;
  password: string;
  deviceName: string;
  platform: Platform;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  userId: string;
  deviceId: string;
};

export type SyncQueueItem = {
  localPath: string;
  documentId: string;
  workspaceId: string;
  baseVersionId: string | null;
  contentHash: string;
  status: "pending" | "uploading" | "failed" | "conflicted";
};
```

```ts
// src/lib/sync/http.ts
export async function postJson<TResponse>(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  accessToken?: string,
): Promise<TResponse> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return (await response.json()) as TResponse;
}
```

```ts
// src/lib/sync/authApi.ts
import { postJson } from "./http";
import type { LoginInput, TokenPair } from "../../types/sync";

type TokenPairResponse = {
  access_token: string;
  refresh_token: string;
  expires_in_seconds: number;
  user_id: string;
  device_id: string;
};

export async function loginWithEmail(
  fetchImpl: typeof fetch,
  baseUrl: string,
  input: LoginInput,
): Promise<TokenPair> {
  const response = await postJson<TokenPairResponse>(fetchImpl, `${baseUrl}/auth/login`, {
    email: input.email,
    password: input.password,
    device_name: input.deviceName,
    platform: input.platform,
  });

  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token,
    expiresInSeconds: response.expires_in_seconds,
    userId: response.user_id,
    deviceId: response.device_id,
  };
}
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run tests/unit/lib/sync/authApi.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/sync.ts src/lib/sync tests/unit/lib/sync/authApi.test.ts
git commit -m "feat: add windows sync auth api client"
```

### Task 2: SQLite Document Mapping on the Tauri Side

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Test: `src-tauri/src/commands/sync.rs`

- [ ] **Step 1: Write failing Rust mapping test**

```rust
// src-tauri/src/commands/sync.rs
use rusqlite::{params, Connection};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DocumentMapping {
    pub local_path: String,
    pub document_id: String,
    pub workspace_id: String,
    pub version_id: Option<String>,
}

pub fn init_sync_schema(connection: &Connection) -> rusqlite::Result<()> {
    connection.execute_batch(
        "create table if not exists document_mappings (
          local_path text primary key,
          document_id text not null,
          workspace_id text not null,
          version_id text
        );",
    )
}

pub fn upsert_document_mapping(connection: &Connection, mapping: &DocumentMapping) -> rusqlite::Result<()> {
    connection.execute(
        "insert into document_mappings (local_path, document_id, workspace_id, version_id)
         values (?1, ?2, ?3, ?4)
         on conflict(local_path) do update set document_id = excluded.document_id, workspace_id = excluded.workspace_id, version_id = excluded.version_id",
        params![mapping.local_path, mapping.document_id, mapping.workspace_id, mapping.version_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{init_sync_schema, upsert_document_mapping, DocumentMapping};
    use rusqlite::Connection;

    #[test]
    fn document_mapping_round_trips_through_sqlite() {
        let connection = Connection::open_in_memory().expect("open sqlite");
        init_sync_schema(&connection).expect("init schema");
        let mapping = DocumentMapping {
            local_path: "E:/notes/a.md".to_string(),
            document_id: "doc_1".to_string(),
            workspace_id: "wks_1".to_string(),
            version_id: Some("ver_1".to_string()),
        };
        upsert_document_mapping(&connection, &mapping).expect("save mapping");
    }
}
```

- [ ] **Step 2: Run Rust test and verify it fails**

Run: `cd src-tauri && cargo test document_mapping_round_trips_through_sqlite`  
Expected: FAIL because `rusqlite` and module wiring are missing.

- [ ] **Step 3: Add dependency and module export**

```toml
# src-tauri/Cargo.toml
rusqlite = { version = "0.32", features = ["bundled"] }
```

```rust
// src-tauri/src/commands/mod.rs
pub mod fs;
pub mod sync;
```

- [ ] **Step 4: Run Rust test**

Run: `cd src-tauri && cargo test document_mapping_round_trips_through_sqlite`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/commands
git commit -m "feat: add sqlite document mapping storage"
```

### Task 3: Zustand Sync Queue State

**Files:**
- Modify: `src/store/editorStore.ts`
- Test: `tests/unit/store/editorStore.test.ts`

- [ ] **Step 1: Write failing store test**

```ts
// tests/unit/store/editorStore.test.ts
it("tracks pending sync items after local save", () => {
  const store = createEditorStore();
  store.getState().enqueueSyncUpload({
    localPath: "E:/notes/a.md",
    documentId: "doc_1",
    workspaceId: "wks_1",
    baseVersionId: "ver_1",
    contentHash: "hash_1234567890123456",
  });

  expect(store.getState().syncQueue).toEqual([
    {
      localPath: "E:/notes/a.md",
      documentId: "doc_1",
      workspaceId: "wks_1",
      baseVersionId: "ver_1",
      contentHash: "hash_1234567890123456",
      status: "pending",
    },
  ]);
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- --run tests/unit/store/editorStore.test.ts`  
Expected: FAIL because `syncQueue` and `enqueueSyncUpload` do not exist.

- [ ] **Step 3: Add queue state**

```ts
// src/store/editorStore.ts
type SyncQueueItem = {
  localPath: string;
  documentId: string;
  workspaceId: string;
  baseVersionId: string | null;
  contentHash: string;
  status: "pending" | "uploading" | "failed" | "conflicted";
};

type EditorState = {
  syncQueue: SyncQueueItem[];
  enqueueSyncUpload: (item: Omit<SyncQueueItem, "status">) => void;
};
```

```ts
// inside createEditorStore initial state
syncQueue: [],
enqueueSyncUpload: (item) =>
  set((state) => ({
    syncQueue: [...state.syncQueue, { ...item, status: "pending" }],
  })),
```

- [ ] **Step 4: Run test**

Run: `npm test -- --run tests/unit/store/editorStore.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/editorStore.ts tests/unit/store/editorStore.test.ts
git commit -m "feat: track pending windows sync uploads"
```

### Task 4: Login Panel

**Files:**
- Create: `src/features/sync/LoginPanel.tsx`
- Create: `src/features/sync/LoginPanel.module.css`
- Modify: `src/app/AppShell.tsx`
- Test: `tests/components/LoginPanel.test.tsx`

- [ ] **Step 1: Write failing component test**

```tsx
// tests/components/LoginPanel.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginPanel } from "../../src/features/sync/LoginPanel";

describe("LoginPanel", () => {
  it("submits email and password", () => {
    const onSubmit = vi.fn();
    render(<LoginPanel isSubmitting={false} errorMessage={null} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery staple" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSubmit).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "correct horse battery staple",
    });
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- --run tests/components/LoginPanel.test.tsx`  
Expected: FAIL because `LoginPanel` does not exist.

- [ ] **Step 3: Implement login panel**

```tsx
// src/features/sync/LoginPanel.tsx
import { FormEvent, useState } from "react";
import styles from "./LoginPanel.module.css";

type LoginPanelProps = {
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (input: { email: string; password: string }) => void;
};

export function LoginPanel({ isSubmitting, errorMessage, onSubmit }: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ email, password });
  };

  return (
    <form className={styles.panel} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
      </label>
      <label className={styles.field}>
        <span>Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
      </label>
      {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
      <button type="submit" disabled={isSubmitting}>Sign in</button>
    </form>
  );
}
```

- [ ] **Step 4: Run component test**

Run: `npm test -- --run tests/components/LoginPanel.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/sync tests/components/LoginPanel.test.tsx src/app/AppShell.tsx
git commit -m "feat: add windows sync login panel"
```

### Task 5: Save Flow Creates Sync Queue Items

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/lib/sync/hash.ts`
- Test: `tests/unit/lib/sync/hash.test.ts`
- Test: `tests/components/App.test.tsx`

- [ ] **Step 1: Write failing hash test**

```ts
// tests/unit/lib/sync/hash.test.ts
import { describe, expect, it } from "vitest";
import { contentHash } from "../../../../src/lib/sync/hash";

describe("contentHash", () => {
  it("returns a stable hex sha256 hash", async () => {
    const first = await contentHash("# Hello");
    const second = await contentHash("# Hello");
    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

Run: `npm test -- --run tests/unit/lib/sync/hash.test.ts`  
Expected: FAIL because `contentHash` does not exist.

- [ ] **Step 3: Add hash helper**

```ts
// src/lib/sync/hash.ts
export async function contentHash(content: string): Promise<string> {
  const data = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 4: Enqueue after successful local save**

```ts
// src/app/App.tsx, after saveMarkdownFile succeeds in saveDocument
const hash = await contentHash(document.content);
editorStore.getState().enqueueSyncUpload({
  localPath: nextPath,
  documentId: "doc_pending_mapping",
  workspaceId: "wks_pending_mapping",
  baseVersionId: null,
  contentHash: hash,
});
```

Use the development mapping IDs only until Task 2 exposes lookup commands to the frontend.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run tests/unit/lib/sync/hash.test.ts tests/components/App.test.tsx`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/App.tsx src/lib/sync/hash.ts tests/unit/lib/sync/hash.test.ts tests/components/App.test.tsx
git commit -m "feat: enqueue cloud sync after windows saves"
```

## Plan Self-Review

- Spec coverage: Windows login, SQLite mapping, sync queue, local-save-first behavior, and conflict display entry points are covered.
- Marker scan: no unresolved markers remain.
- Type consistency: `TokenPair`, `SyncQueueItem`, and mapping fields align with the backend contract.
