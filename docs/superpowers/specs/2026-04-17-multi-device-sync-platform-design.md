# Multi-Device Sync Platform Design

## Overview

This design expands the Markdown editor from a local-only Windows desktop app into a multi-device cloud sync platform.

The first implementation phase focuses on a contract-first Rust backend and sync protocol that can support:

- Windows desktop via the existing Tauri 2 + React client
- Android via a native Kotlin client
- iOS via a native Swift client

macOS is outside the current implementation scope. The protocol and data model must stay platform-neutral so macOS can be added later without changing the cloud identity model.

## Confirmed Product Direction

- Account system: email and password with a self-hosted user system
- Token model: short-lived access token plus long-lived refresh token
- Cloud metadata database: PostgreSQL
- Cloud object storage: MinIO
- Backend shape: three Rust microservices
- Sync model: full Markdown document version per save
- Conflict handling: conservative conflict copies, no automatic merge in the MVP
- Desktop client: existing Windows Tauri app
- Android client: native Kotlin
- iOS client: native Swift
- Document organization: hybrid workspace/document model

## Current Project Context

The existing app is a local-first Markdown editor with:

- Tauri 2 desktop shell
- React 19, TypeScript, and Vite frontend
- CodeMirror 6 source editing
- react-markdown preview
- Zustand state
- Rust Tauri filesystem commands for scanning folders, reading Markdown files, and saving Markdown files

The current Rust side is embedded in `src-tauri`. It is desktop-local command code, not a network backend. The new backend should be added as a separate Rust workspace under `backend/` so the Tauri local command layer remains focused on desktop integration.

## Architecture

The first phase uses a contract-first three-service backend.

The contract comes first:

1. Define shared IDs, error codes, OpenAPI schemas, request payloads, and response payloads.
2. Implement the Rust services against that contract.
3. Implement Windows, Android, and iOS client API wrappers against the same contract.

### Backend Services

#### Auth Service

Responsible for identity and sessions:

- Email/password registration
- Login
- Password hash verification
- Access token signing
- Refresh token issuing, rotation, and revocation
- Logout
- Current-user lookup

#### Sync Service

Responsible for user-owned sync state:

- Device registration
- Workspace metadata
- Document metadata
- Document versions
- Sync cursors
- Change feed
- Soft deletion events
- Conflict detection and conflict records

#### Storage Service

Responsible for object storage access:

- MinIO object key generation
- Presigned upload URLs
- Presigned download URLs
- Object ownership validation
- Object confirmation after upload
- Delete-marking hooks for future lifecycle cleanup

The clients and Sync Service never receive raw MinIO root credentials.

### Infrastructure

The MVP deployment target is a single-machine Docker Compose setup with separately running services:

- Auth Service
- Sync Service
- Storage Service
- PostgreSQL
- MinIO
- API gateway or reverse proxy

This shape supports a small deployment while preserving service boundaries for future multi-machine deployment.

## Data Model

Cloud identity must not depend on local absolute paths. Windows paths, Android sandbox paths, and iOS app-container paths are local mappings only.

### User

Represents the account owner.

Required fields:

- `user_id`
- `email`
- `password_hash`
- `status`
- `created_at`
- `updated_at`

### Refresh Token

Represents a revocable long-lived session credential.

Required fields:

- `refresh_token_id`
- `user_id`
- `device_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`
- `last_used_at`

Only token hashes are stored in PostgreSQL.

### Device

Represents one user device.

Required fields:

- `device_id`
- `user_id`
- `platform`
- `display_name`
- `created_at`
- `last_seen_at`

Allowed initial platform values:

- `windows`
- `android`
- `ios`

### Workspace

Represents a sync container for documents.

Required fields:

- `workspace_id`
- `user_id`
- `name`
- `created_at`
- `updated_at`
- `deleted_at`

Windows maps a workspace to a local folder. Android and iOS map a workspace to an app-managed document library.

### Document

Represents a logical Markdown document.

Required fields:

- `document_id`
- `workspace_id`
- `title`
- `current_version_id`
- `created_at`
- `updated_at`
- `deleted_at`

### Document Version

Represents one complete Markdown save.

Required fields:

- `version_id`
- `document_id`
- `base_version_id`
- `author_device_id`
- `content_hash`
- `object_key`
- `content_size`
- `created_at`

The Markdown body is stored in MinIO. PostgreSQL stores version metadata and object references.

### Sync Cursor

Represents a device's progress through a workspace change feed.

Required fields:

- `cursor_id`
- `workspace_id`
- `device_id`
- `last_change_id`
- `updated_at`

### Change Event

Represents a sync-visible mutation.

Required fields:

- `change_id`
- `workspace_id`
- `document_id`
- `version_id`
- `change_type`
- `created_at`

Initial `change_type` values:

- `document_created`
- `document_updated`
- `document_deleted`
- `conflict_created`

### Conflict

Represents a preserved conflicting version.

Required fields:

- `conflict_id`
- `document_id`
- `server_version_id`
- `conflicting_version_id`
- `device_id`
- `status`
- `created_at`
- `resolved_at`

Initial `status` values:

- `open`
- `resolved`
- `dismissed`

### Attachment

Represents an image or other file referenced by a document.

Required fields:

- `attachment_id`
- `workspace_id`
- `document_id`
- `object_key`
- `content_hash`
- `media_type`
- `size`
- `created_at`

## Client Mapping

### Windows

The existing Tauri client keeps the local filesystem as the primary editing surface.

Windows local SQLite stores:

- Account session metadata
- Device ID
- Workspace-to-folder mapping
- Local file path to `document_id` mapping
- Last known `version_id`
- Sync queue
- Sync cursor
- Conflict status

Markdown content remains saved as `.md` files in the user's selected workspace folder.

### Android

The Android client is native Kotlin.

Local storage requirements:

- Room or SQLDelight for metadata
- App sandbox files for Markdown content
- Android Keystore-backed token protection
- Local sync queue and cursor tables

The UI presents an app-managed document library rather than arbitrary filesystem folders.

### iOS

The iOS client is native Swift.

Local storage requirements:

- SQLite or Core Data for metadata
- App container files for Markdown content
- Keychain for refresh token storage
- Local sync queue and cursor tables

The UI presents an app-managed document library.

## API Boundaries

All external API payloads should be defined in OpenAPI before implementation.

### Auth Service API

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Sync Service API

- `POST /devices/register`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/{workspace_id}/changes`
- `POST /documents`
- `GET /documents/{document_id}`
- `POST /documents/{document_id}/versions`
- `POST /documents/{document_id}/delete`
- `GET /conflicts`
- `POST /conflicts/{conflict_id}/resolve`

### Storage Service API

- `POST /storage/upload-url`
- `POST /storage/download-url`
- `POST /storage/objects/confirm`
- `POST /storage/objects/delete-mark`

## Service Authentication

Clients authenticate with access tokens on all protected API calls.

Refresh token behavior:

- The client stores the refresh token in a platform-secure location.
- Access token expiry triggers a refresh attempt.
- Refresh token rotation is preferred for the MVP.
- Logout revokes the refresh token.
- Password changes or account disablement must revoke active refresh tokens.

Service-to-service authentication:

- Auth Service signs access tokens.
- Sync Service and Storage Service validate access tokens.
- Sync Service and Storage Service use an internal service secret in Docker Compose.
- The design should leave room for mTLS or stronger service identity later.

## Sync Flow

### Initial Login and Device Registration

1. The client registers or logs in with email and password.
2. Auth Service returns an access token and refresh token.
3. The client registers the current device with Sync Service.
4. Sync Service returns a stable `device_id`.
5. The client stores `device_id` locally.

### Pull Changes

1. The client reads the local workspace cursor.
2. The client calls `GET /workspaces/{workspace_id}/changes`.
3. Sync Service returns changes after the cursor.
4. For each new document version, the client requests a download URL from Storage Service.
5. The client downloads Markdown content from MinIO and writes it locally.
6. The client updates local metadata and advances the cursor.

### Push Document Version

1. The user saves Markdown content locally.
2. The client records a pending sync item with the local content hash and base version.
3. The client requests an upload URL from Storage Service.
4. The client uploads the Markdown body to MinIO.
5. The client confirms the object upload with Storage Service.
6. The client calls `POST /documents/{document_id}/versions` on Sync Service.
7. Sync Service compares `base_version_id` with the document's current version.
8. If base matches current, Sync Service creates the new version and updates the document current version.
9. If base is stale, Sync Service creates a conflict record and keeps both versions.

### Conflict Handling

The MVP uses conservative conflict copies.

When concurrent edits are detected:

- The server does not overwrite the current version.
- The conflicting upload remains addressable as a version.
- A conflict record is created.
- The client receives a conflict response.
- The client shows the document as conflicted.
- The user manually resolves the conflict by choosing one version or creating a merged local document.

Automatic text merge, block-level sync, operation-level sync, and CRDT are outside the MVP.

### Delete Handling

Deletion is soft.

When a document is deleted:

- Sync Service writes `deleted_at`.
- Sync Service emits a `document_deleted` change.
- Other devices pull the deletion event.
- Clients mark the document deleted locally or move it into a local recycle-bin view.
- MinIO objects are kept for history and recovery in the MVP.

## Error Handling

All services should return structured errors with stable machine-readable codes.

Required initial error categories:

- `401 unauthorized`: access token is missing, expired, or invalid
- `403 forbidden`: user cannot access the target resource
- `409 conflict`: version submission conflicts with the current server version
- `422 validation_error`: invalid payload, weak password, invalid email, missing field, or hash mismatch
- `507 storage_quota_exceeded`: reserved for future quota enforcement
- `503 service_unavailable`: PostgreSQL, MinIO, or an internal service dependency is unavailable

Clients must preserve local content when any sync request fails.

## Offline Strategy

All clients are local-first.

Common rules:

- User edits save locally first.
- Sync is asynchronous.
- Failed sync items remain in a retry queue.
- Each queued document version carries `base_version_id`.
- Network recovery triggers queued uploads and change pulls.
- Token refresh runs before protected API retries.
- Conflicts are visible and require user action.

Windows-specific behavior:

- The local `.md` file remains the source the user sees and edits.
- SQLite records cloud mapping and sync status.
- A failed upload must not mark the local file as clean from a cloud-sync perspective.

Android/iOS-specific behavior:

- Markdown files live in the app sandbox.
- The document library is built from local metadata.
- Token storage uses platform-secure storage.
- Background sync can be added later; foreground sync is sufficient for the MVP.

## Repository Structure

The backend should be added without merging network backend concerns into `src-tauri`.

Proposed structure:

```text
backend/
  Cargo.toml
  crates/
    common/
    api-contract/
  services/
    auth-service/
    sync-service/
    storage-service/
  migrations/
  openapi/
  tests/
docker-compose.yml
docs/
  superpowers/
    specs/
    plans/
```

The current frontend and Tauri app remain under:

```text
src/
src-tauri/
tests/
```

## Testing Strategy

### Backend Unit Tests

Required areas:

- Password hashing and verification
- Token issuing and validation
- Refresh token rotation and revocation
- Device registration rules
- Version advancement
- Stale base version conflict creation
- Storage object key generation
- Object ownership validation

### Backend Integration Tests

Run against test PostgreSQL and MinIO.

Required flows:

- Register, login, refresh, logout
- Register device
- Create workspace
- Create document
- Upload Markdown object
- Confirm object
- Create document version
- Pull changes
- Submit a stale base version and receive a conflict
- Soft delete document and pull deletion

### Contract Tests

OpenAPI examples should cover:

- Auth happy paths and failures
- Device registration
- Workspace listing and creation
- Document creation
- Version creation
- Conflict response
- Storage upload/download URL requests

Windows, Android, and iOS API wrappers must be tested against the same request and response examples.

### Client Tests

Windows:

- Login state transitions
- Local path to document ID mapping
- Sync queue creation after save
- Token refresh retry
- Conflict status rendering

Android:

- Login and token persistence
- Local document library creation
- Sync queue persistence
- Offline save and retry
- Conflict display

iOS:

- Login and Keychain token persistence
- Local document library creation
- Sync queue persistence
- Offline save and retry
- Conflict display

## Implementation Plan Split

The design should be executed through four plan documents:

1. `docs/superpowers/plans/2026-04-17-rust-backend-sync-mvp.md`
   - Rust backend workspace
   - PostgreSQL migrations
   - Auth Service
   - Sync Service
   - Storage Service
   - OpenAPI
   - Docker Compose
   - Integration tests

2. `docs/superpowers/plans/2026-04-17-windows-client-sync.md`
   - Existing Tauri Windows client login
   - Local SQLite sync metadata
   - Local path to cloud document mapping
   - Upload/download sync queue
   - Conflict UI

3. `docs/superpowers/plans/2026-04-17-android-client-sync.md`
   - Native Kotlin client
   - Login
   - Local document library
   - Markdown editing and preview
   - Sync API integration
   - Offline cache
   - Conflict UI

4. `docs/superpowers/plans/2026-04-17-ios-client-sync.md`
   - Native Swift client
   - Login
   - Local document library
   - Markdown editing and preview
   - Sync API integration
   - Keychain token storage
   - Offline cache
   - Conflict UI

## Out of Scope

- macOS client implementation
- Real-time collaboration
- CRDT or operation-level sync
- Block-level sync
- Automatic three-way merge
- Enterprise tenant management
- Admin dashboard
- Public share links
- Complex object lifecycle cleanup
- Quota enforcement beyond reserved error codes

## Acceptance Criteria

The platform design is ready for implementation planning when:

- The backend is clearly separated from the existing Tauri command layer.
- Auth, Sync, and Storage service responsibilities are distinct.
- PostgreSQL and MinIO responsibilities are explicit.
- The sync model supports Windows local folders and mobile app libraries.
- The model does not depend on platform-specific file paths.
- Conflict handling preserves user content.
- Offline-first client behavior is defined for Windows, Android, and iOS.
- The implementation work is split into backend, Windows, Android, and iOS plans.
