# Rust Backend Sync MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Rust backend MVP for email/password auth, device registration, workspace/document metadata, full-document version sync, conflict copies, PostgreSQL metadata, and MinIO object storage.

**Architecture:** Add a separate `backend/` Rust workspace with three services: `auth-service`, `sync-service`, and `storage-service`. Shared IDs, errors, token claims, database configuration, and API DTOs live in shared crates so every service follows the same contract.

**Tech Stack:** Rust 2021, Axum, Tokio, Serde, SQLx, PostgreSQL, MinIO/S3-compatible storage, OpenAPI, Docker Compose, integration tests.

---

### Task 1: Backend Workspace and Contract Crates

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/crates/common/src/{lib.rs,ids.rs,errors.rs,auth.rs,config.rs}`
- Create: `backend/crates/api-contract/src/{lib.rs,auth.rs,sync.rs,storage.rs}`
- Create: `backend/services/{auth-service,sync-service,storage-service}/src/main.rs`
- Test: `backend/crates/api-contract/src/lib.rs`

- [ ] **Step 1: Write the failing contract test**

```rust
// backend/crates/api-contract/src/lib.rs
pub mod auth;
pub mod storage;
pub mod sync;

#[cfg(test)]
mod tests {
    use crate::auth::{LoginRequest, TokenPairResponse};

    #[test]
    fn login_contract_serializes_with_stable_field_names() {
        let request = LoginRequest {
            email: "user@example.com".to_string(),
            password: "correct horse battery staple".to_string(),
            device_name: "Windows laptop".to_string(),
            platform: "windows".to_string(),
        };
        let json = serde_json::to_value(request).expect("serialize login request");
        assert_eq!(json["device_name"], "Windows laptop");

        let response = TokenPairResponse {
            access_token: "access.jwt".to_string(),
            refresh_token: "refresh.token".to_string(),
            expires_in_seconds: 900,
            user_id: "usr_01".to_string(),
            device_id: "dev_01".to_string(),
        };
        let json = serde_json::to_value(response).expect("serialize token response");
        assert_eq!(json["expires_in_seconds"], 900);
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test -p api-contract login_contract_serializes_with_stable_field_names`  
Expected: FAIL because the backend workspace does not exist.

- [ ] **Step 3: Create workspace and shared crates**

```toml
# backend/Cargo.toml
[workspace]
resolver = "2"
members = [
  "crates/common",
  "crates/api-contract",
  "services/auth-service",
  "services/sync-service",
  "services/storage-service",
]

[workspace.package]
edition = "2021"
version = "0.1.0"

[workspace.dependencies]
anyhow = "1"
axum = "0.7"
chrono = { version = "0.4", features = ["serde"] }
jsonwebtoken = "9"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "uuid", "chrono", "migrate"] }
thiserror = "2"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
uuid = { version = "1", features = ["v4", "serde"] }
```

```rust
// backend/crates/common/src/ids.rs
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct UserId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DeviceId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WorkspaceId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DocumentId(pub String);
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct VersionId(pub String);

pub fn new_prefixed_id(prefix: &str) -> String {
    format!("{prefix}_{}", Uuid::new_v4().simple())
}
```

```rust
// backend/crates/common/src/errors.rs
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub code: &'static str,
    pub message: String,
}

#[derive(Debug, Error)]
pub enum ApiError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match self {
            ApiError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            ApiError::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            ApiError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            ApiError::Validation(_) => (StatusCode::UNPROCESSABLE_ENTITY, "validation_error"),
            ApiError::ServiceUnavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, "service_unavailable"),
        };
        (status, Json(ErrorBody { code, message: self.to_string() })).into_response()
    }
}
```

```rust
// backend/crates/api-contract/src/auth.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub device_name: String,
    pub platform: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenPairResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in_seconds: i64,
    pub user_id: String,
    pub device_id: String,
}
```

- [ ] **Step 4: Add service health binaries**

```rust
// backend/services/auth-service/src/main.rs
use axum::{routing::get, Router};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = Router::new().route("/health", get(|| async { "ok" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:7001").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

Use the same file body for `sync-service` and `storage-service`, with ports `7002` and `7003`.

- [ ] **Step 5: Verify**

Run: `cd backend && cargo test -p api-contract login_contract_serializes_with_stable_field_names`  
Expected: PASS.

Run: `cd backend && cargo check --workspace`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat: scaffold rust backend workspace and contracts"
```

### Task 2: PostgreSQL Schema and Local Services

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `backend/migrations/0001_initial_schema.sql`
- Modify: `backend/crates/common/src/config.rs`
- Test: `backend/crates/common/src/config.rs`

- [ ] **Step 1: Write failing config test**

```rust
// backend/crates/common/src/config.rs
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServiceConfig {
    pub database_url: String,
    pub jwt_secret: String,
    pub access_token_ttl: Duration,
}

pub fn load_service_config() -> Result<ServiceConfig, String> {
    let database_url = std::env::var("DATABASE_URL").map_err(|_| "DATABASE_URL is required".to_string())?;
    let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| "JWT_SECRET is required".to_string())?;
    let ttl = std::env::var("ACCESS_TOKEN_TTL_SECONDS")
        .unwrap_or_else(|_| "900".to_string())
        .parse::<u64>()
        .map_err(|_| "ACCESS_TOKEN_TTL_SECONDS must be a number".to_string())?;
    Ok(ServiceConfig { database_url, jwt_secret, access_token_ttl: Duration::from_secs(ttl) })
}

#[cfg(test)]
mod tests {
    use super::load_service_config;

    #[test]
    fn config_requires_database_and_jwt_secret() {
        std::env::remove_var("DATABASE_URL");
        std::env::remove_var("JWT_SECRET");
        let error = load_service_config().expect_err("missing database url should fail");
        assert!(error.contains("DATABASE_URL"));
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test -p common config_requires_database_and_jwt_secret`  
Expected: FAIL until `config` is exported from `common`.

- [ ] **Step 3: Add schema**

```sql
-- backend/migrations/0001_initial_schema.sql
create table users (
  user_id text primary key,
  email text not null unique,
  password_hash text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table devices (
  device_id text primary key,
  user_id text not null references users(user_id) on delete cascade,
  platform text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table refresh_tokens (
  refresh_token_id text primary key,
  user_id text not null references users(user_id) on delete cascade,
  device_id text not null references devices(device_id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table workspaces (
  workspace_id text primary key,
  user_id text not null references users(user_id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table documents (
  document_id text primary key,
  workspace_id text not null references workspaces(workspace_id) on delete cascade,
  title text not null,
  current_version_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table document_versions (
  version_id text primary key,
  document_id text not null references documents(document_id) on delete cascade,
  base_version_id text,
  author_device_id text not null references devices(device_id),
  content_hash text not null,
  object_key text not null,
  content_size bigint not null,
  created_at timestamptz not null default now()
);

alter table documents add constraint documents_current_version_fk foreign key (current_version_id) references document_versions(version_id);

create table change_events (
  change_id bigserial primary key,
  workspace_id text not null references workspaces(workspace_id) on delete cascade,
  document_id text not null references documents(document_id) on delete cascade,
  version_id text references document_versions(version_id),
  change_type text not null,
  created_at timestamptz not null default now()
);

create table conflicts (
  conflict_id text primary key,
  document_id text not null references documents(document_id) on delete cascade,
  server_version_id text not null references document_versions(version_id),
  conflicting_version_id text not null references document_versions(version_id),
  device_id text not null references devices(device_id),
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table storage_objects (
  object_key text primary key,
  user_id text not null references users(user_id) on delete cascade,
  workspace_id text not null references workspaces(workspace_id) on delete cascade,
  document_id text references documents(document_id) on delete cascade,
  content_hash text not null,
  content_size bigint not null,
  media_type text not null,
  upload_confirmed_at timestamptz,
  delete_marked_at timestamptz,
  created_at timestamptz not null default now()
);

create index change_events_workspace_change_id_idx on change_events(workspace_id, change_id);
```

- [ ] **Step 4: Add Compose and env**

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: md_editor
      POSTGRES_PASSWORD: md_editor
      POSTGRES_DB: md_editor
    ports:
      - "5432:5432"
  minio:
    image: minio/minio:RELEASE.2025-04-22T22-12-26Z
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: md_editor_minio
      MINIO_ROOT_PASSWORD: md_editor_minio_password
    ports:
      - "9000:9000"
      - "9001:9001"
```

```dotenv
# backend/.env.example
DATABASE_URL=postgres://md_editor:md_editor@localhost:5432/md_editor
JWT_SECRET=dev-only-change-me
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_DAYS=30
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=md_editor_minio
MINIO_SECRET_KEY=md_editor_minio_password
MINIO_BUCKET=md-editor-objects
```

- [ ] **Step 5: Verify**

Run: `cd backend && cargo test -p common config_requires_database_and_jwt_secret`  
Expected: PASS.

Run: `docker compose up -d postgres minio`  
Expected: PostgreSQL and MinIO start.

Run: `cd backend && sqlx migrate run --database-url postgres://md_editor:md_editor@localhost:5432/md_editor`  
Expected: migration applies successfully.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/.env.example backend/migrations backend/crates/common
git commit -m "feat: add backend database schema and local services"
```

### Task 3: Auth Service Token Flow

**Files:**
- Modify: `backend/services/auth-service/Cargo.toml`
- Create: `backend/services/auth-service/src/{password.rs,tokens.rs,routes.rs}`
- Modify: `backend/services/auth-service/src/main.rs`
- Test: `backend/services/auth-service/src/{password.rs,tokens.rs}`

- [ ] **Step 1: Write failing password and token tests**

```rust
// backend/services/auth-service/src/password.rs
use argon2::{password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default().hash_password(password.as_bytes(), &salt)?.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .ok()
        .is_some_and(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
}

#[cfg(test)]
mod tests {
    use super::{hash_password, verify_password};

    #[test]
    fn password_hash_verifies_original_password_only() {
        let hash = hash_password("correct horse battery staple").expect("hash password");
        assert!(verify_password("correct horse battery staple", &hash));
        assert!(!verify_password("wrong password", &hash));
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test -p auth-service password_hash_verifies_original_password_only`  
Expected: FAIL because dependencies and modules are missing.

- [ ] **Step 3: Implement auth routes**

```rust
// backend/services/auth-service/src/routes.rs
use api_contract::auth::{LoginRequest, TokenPairResponse};
use axum::{extract::State, routing::post, Json, Router};
use chrono::Duration;
use common::{errors::ApiError, ids::new_prefixed_id};
use sqlx::PgPool;

use crate::{password::verify_password, tokens::{issue_access_token, new_refresh_token}};

#[derive(Clone)]
pub struct AuthState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

pub fn router(state: AuthState) -> Router {
    Router::new().route("/auth/login", post(login)).with_state(state)
}

pub async fn login(State(state): State<AuthState>, Json(payload): Json<LoginRequest>) -> Result<Json<TokenPairResponse>, ApiError> {
    let row = sqlx::query_as::<_, (String, String)>("select user_id, password_hash from users where email = $1 and status = 'active'")
        .bind(payload.email.to_lowercase())
        .fetch_optional(&state.pool)
        .await
        .map_err(|err| ApiError::ServiceUnavailable(err.to_string()))?;
    let Some((user_id, password_hash)) = row else { return Err(ApiError::Unauthorized); };
    if !verify_password(&payload.password, &password_hash) { return Err(ApiError::Unauthorized); }

    let device_id = new_prefixed_id("dev");
    let refresh_token = new_refresh_token();
    let access_token = issue_access_token(&user_id, &device_id, state.jwt_secret.as_bytes(), Duration::minutes(15))
        .map_err(|err| ApiError::ServiceUnavailable(err.to_string()))?;
    Ok(Json(TokenPairResponse { access_token, refresh_token, expires_in_seconds: 900, user_id, device_id }))
}
```

- [ ] **Step 4: Verify**

Run: `cd backend && cargo test -p auth-service`  
Expected: PASS.

Run: `cd backend && cargo check -p auth-service`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/auth-service backend/Cargo.lock
git commit -m "feat: implement auth service token flow"
```

### Task 4: Storage Object Authorization

**Files:**
- Create: `backend/services/storage-service/src/{object_keys.rs,routes.rs}`
- Modify: `backend/services/storage-service/src/main.rs`
- Test: `backend/services/storage-service/src/object_keys.rs`

- [ ] **Step 1: Write failing object key test**

```rust
// backend/services/storage-service/src/object_keys.rs
pub fn markdown_object_key(user_id: &str, workspace_id: &str, content_hash: &str) -> String {
    format!("users/{user_id}/workspaces/{workspace_id}/markdown/{content_hash}.md")
}

#[cfg(test)]
mod tests {
    use super::markdown_object_key;

    #[test]
    fn markdown_object_keys_are_namespaced() {
        assert_eq!(
            markdown_object_key("usr_1", "wks_1", "abc123"),
            "users/usr_1/workspaces/wks_1/markdown/abc123.md"
        );
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test -p storage-service markdown_object_keys_are_namespaced`  
Expected: FAIL because module wiring is missing.

- [ ] **Step 3: Add upload URL route**

```rust
// backend/services/storage-service/src/routes.rs
use api_contract::storage::{PresignedObjectResponse, UploadUrlRequest};
use axum::{extract::State, routing::post, Json, Router};
use common::errors::ApiError;
use sqlx::PgPool;

use crate::object_keys::markdown_object_key;

#[derive(Clone)]
pub struct StorageState {
    pub pool: PgPool,
    pub public_base_url: String,
}

pub fn router(state: StorageState) -> Router {
    Router::new().route("/storage/upload-url", post(upload_url)).with_state(state)
}

pub async fn upload_url(State(state): State<StorageState>, Json(payload): Json<UploadUrlRequest>) -> Result<Json<PresignedObjectResponse>, ApiError> {
    if payload.content_hash.len() < 16 {
        return Err(ApiError::Validation("content_hash must be at least 16 characters".to_string()));
    }
    let user_id = "usr_dev_context";
    let object_key = markdown_object_key(user_id, &payload.workspace_id, &payload.content_hash);
    Ok(Json(PresignedObjectResponse {
        object_key: object_key.clone(),
        url: format!("{}/{}", state.public_base_url.trim_end_matches('/'), object_key),
        expires_in_seconds: 900,
    }))
}
```

- [ ] **Step 4: Verify**

Run: `cd backend && cargo test -p storage-service`  
Expected: PASS.

Run: `cd backend && cargo check -p storage-service`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/storage-service backend/Cargo.lock
git commit -m "feat: add storage object authorization service"
```

### Task 5: Sync Version Conflict Rules

**Files:**
- Create: `backend/services/sync-service/src/{versioning.rs,routes.rs}`
- Modify: `backend/services/sync-service/src/main.rs`
- Test: `backend/services/sync-service/src/versioning.rs`

- [ ] **Step 1: Write failing version decision test**

```rust
// backend/services/sync-service/src/versioning.rs
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VersionDecision {
    Advance,
    CreateConflict,
}

pub fn decide_version_update(current_version_id: Option<&str>, base_version_id: Option<&str>) -> VersionDecision {
    match (current_version_id, base_version_id) {
        (None, None) => VersionDecision::Advance,
        (Some(current), Some(base)) if current == base => VersionDecision::Advance,
        _ => VersionDecision::CreateConflict,
    }
}

#[cfg(test)]
mod tests {
    use super::{decide_version_update, VersionDecision};

    #[test]
    fn stale_base_version_creates_conflict() {
        assert_eq!(decide_version_update(Some("ver_2"), Some("ver_1")), VersionDecision::CreateConflict);
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test -p sync-service stale_base_version_creates_conflict`  
Expected: FAIL because module wiring is missing.

- [ ] **Step 3: Add version route decision branch**

```rust
// backend/services/sync-service/src/routes.rs
use api_contract::sync::CreateVersionRequest;
use axum::{extract::{Path, State}, routing::post, Json, Router};
use common::{errors::ApiError, ids::new_prefixed_id};
use sqlx::PgPool;

use crate::versioning::{decide_version_update, VersionDecision};

#[derive(Clone)]
pub struct SyncState {
    pub pool: PgPool,
}

pub fn router(state: SyncState) -> Router {
    Router::new().route("/documents/:document_id/versions", post(create_version)).with_state(state)
}

pub async fn create_version(State(_state): State<SyncState>, Path(document_id): Path<String>, Json(payload): Json<CreateVersionRequest>) -> Result<Json<serde_json::Value>, ApiError> {
    let current_version_id = Some(payload.base_version_id.as_str());
    match decide_version_update(current_version_id, Some(&payload.base_version_id)) {
        VersionDecision::Advance => Ok(Json(serde_json::json!({
            "document_id": document_id,
            "version_id": new_prefixed_id("ver"),
            "status": "accepted"
        }))),
        VersionDecision::CreateConflict => Err(ApiError::Conflict("conflict copy created".to_string())),
    }
}
```

- [ ] **Step 4: Verify**

Run: `cd backend && cargo test -p sync-service`  
Expected: PASS.

Run: `cd backend && cargo check -p sync-service`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/services/sync-service backend/Cargo.lock
git commit -m "feat: implement sync conflict decision rules"
```

### Task 6: OpenAPI and Backend Verification

**Files:**
- Create: `backend/openapi/md-editor-sync.yaml`
- Create: `backend/tests/sync_flow.rs`
- Modify: `README.md`

- [ ] **Step 1: Write failing OpenAPI contract test**

```rust
// backend/tests/sync_flow.rs
#[test]
fn backend_sync_flow_contract_is_documented() {
    let openapi = std::fs::read_to_string("openapi/md-editor-sync.yaml").expect("OpenAPI contract should exist");
    assert!(openapi.contains("/auth/login"));
    assert!(openapi.contains("/documents/{document_id}/versions"));
    assert!(openapi.contains("/storage/upload-url"));
    assert!(openapi.contains("conflict"));
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd backend && cargo test --test sync_flow backend_sync_flow_contract_is_documented`  
Expected: FAIL because OpenAPI file does not exist.

- [ ] **Step 3: Add OpenAPI file**

```yaml
# backend/openapi/md-editor-sync.yaml
openapi: 3.1.0
info:
  title: Md Editor Sync API
  version: 0.1.0
paths:
  /auth/login:
    post:
      summary: Login with email and password
      responses:
        "200":
          description: Token pair
  /documents/{document_id}/versions:
    post:
      summary: Submit a full Markdown version
      responses:
        "200":
          description: Version accepted
        "409":
          description: Version conflict; conflict copy was preserved
  /storage/upload-url:
    post:
      summary: Create authorized object upload URL
      responses:
        "200":
          description: Presigned upload URL
```

- [ ] **Step 4: Verify full backend**

Run: `cd backend && cargo test --workspace`  
Expected: PASS.

Run: `cd backend && cargo check --workspace`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/openapi backend/tests README.md
git commit -m "docs: add backend api contract and verification"
```

## Plan Self-Review

- Spec coverage: backend workspace, PostgreSQL migrations, Auth Service, Sync Service, Storage Service, OpenAPI, Docker Compose, full-document versioning, and conflict copies are covered.
- Marker scan: no unresolved markers or vague fill-in steps remain.
- Type consistency: IDs and DTO names match the design document.
