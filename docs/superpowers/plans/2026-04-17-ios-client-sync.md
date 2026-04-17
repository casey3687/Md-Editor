# iOS Client Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a native Swift iOS client with email login, Keychain token storage boundary, app-container Markdown document library, offline saves, sync queue persistence, and conflict visibility.

**Architecture:** Add a standalone `ios/` Swift package and app source layout. API contracts use Codable structs, token persistence goes through a `TokenStore` protocol, and local document sync state goes through a repository interface.

**Tech Stack:** Swift 5.10, SwiftUI, Foundation URLSession, Codable, Keychain Services boundary, SQLite/Core Data boundary, XCTest.

---

### Task 1: Swift Package and API Models

**Files:**
- Create: `ios/Package.swift`
- Create: `ios/Sources/MdEditorSync/API/AuthModels.swift`
- Test: `ios/Tests/MdEditorSyncTests/AuthModelsTests.swift`

- [ ] **Step 1: Write failing Codable field-name test**

```swift
// ios/Tests/MdEditorSyncTests/AuthModelsTests.swift
import XCTest
@testable import MdEditorSync

final class AuthModelsTests: XCTestCase {
    func testLoginRequestUsesBackendFieldNames() throws {
        let request = LoginRequest(
            email: "user@example.com",
            password: "correct horse battery staple",
            deviceName: "iPhone",
            platform: "ios"
        )

        let data = try JSONEncoder().encode(request)
        let json = String(data: data, encoding: .utf8) ?? ""

        XCTAssertTrue(json.contains("\"device_name\":\"iPhone\""))
        XCTAssertTrue(json.contains("\"platform\":\"ios\""))
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd ios && swift test --filter AuthModelsTests`  
Expected: FAIL because the Swift package and models do not exist.

- [ ] **Step 3: Add package and auth models**

```swift
// ios/Package.swift
// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "MdEditorSync",
    platforms: [.iOS(.v16)],
    products: [
        .library(name: "MdEditorSync", targets: ["MdEditorSync"])
    ],
    targets: [
        .target(name: "MdEditorSync"),
        .testTarget(name: "MdEditorSyncTests", dependencies: ["MdEditorSync"])
    ]
)
```

```swift
// ios/Sources/MdEditorSync/API/AuthModels.swift
import Foundation

public struct LoginRequest: Codable, Equatable {
    public let email: String
    public let password: String
    public let deviceName: String
    public let platform: String

    enum CodingKeys: String, CodingKey {
        case email
        case password
        case deviceName = "device_name"
        case platform
    }

    public init(email: String, password: String, deviceName: String, platform: String) {
        self.email = email
        self.password = password
        self.deviceName = deviceName
        self.platform = platform
    }
}

public struct TokenPairResponse: Codable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresInSeconds: Int
    public let userId: String
    public let deviceId: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresInSeconds = "expires_in_seconds"
        case userId = "user_id"
        case deviceId = "device_id"
    }
}
```

- [ ] **Step 4: Verify**

Run: `cd ios && swift test --filter AuthModelsTests`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ios
git commit -m "feat: scaffold native ios sync package"
```

### Task 2: Token Store Boundary

**Files:**
- Create: `ios/Sources/MdEditorSync/Auth/TokenStore.swift`
- Test: `ios/Tests/MdEditorSyncTests/TokenStoreTests.swift`

- [ ] **Step 1: Write failing token store test**

```swift
// ios/Tests/MdEditorSyncTests/TokenStoreTests.swift
import XCTest
@testable import MdEditorSync

final class TokenStoreTests: XCTestCase {
    func testInMemoryTokenStoreSavesSession() {
        let store = InMemoryTokenStore()
        let tokens = SessionTokens(
            accessToken: "access",
            refreshToken: "refresh",
            userId: "usr_1",
            deviceId: "dev_1"
        )

        store.save(tokens)

        XCTAssertEqual(store.load(), tokens)
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd ios && swift test --filter TokenStoreTests`  
Expected: FAIL because token store types do not exist.

- [ ] **Step 3: Add token store protocol**

```swift
// ios/Sources/MdEditorSync/Auth/TokenStore.swift
import Foundation

public struct SessionTokens: Codable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let userId: String
    public let deviceId: String

    public init(accessToken: String, refreshToken: String, userId: String, deviceId: String) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.userId = userId
        self.deviceId = deviceId
    }
}

public protocol TokenStore {
    func save(_ tokens: SessionTokens)
    func load() -> SessionTokens?
    func clear()
}

public final class InMemoryTokenStore: TokenStore {
    private var tokens: SessionTokens?

    public init() {}

    public func save(_ tokens: SessionTokens) {
        self.tokens = tokens
    }

    public func load() -> SessionTokens? {
        tokens
    }

    public func clear() {
        tokens = nil
    }
}
```

The production app adds a Keychain-backed implementation behind this same `TokenStore` protocol.

- [ ] **Step 4: Verify**

Run: `cd ios && swift test --filter TokenStoreTests`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/Sources/MdEditorSync/Auth ios/Tests/MdEditorSyncTests/TokenStoreTests.swift
git commit -m "feat: add ios token store boundary"
```

### Task 3: Local Document Library and Queue

**Files:**
- Create: `ios/Sources/MdEditorSync/Data/DocumentModels.swift`
- Create: `ios/Sources/MdEditorSync/Data/DocumentLibraryRepository.swift`
- Test: `ios/Tests/MdEditorSyncTests/DocumentLibraryRepositoryTests.swift`

- [ ] **Step 1: Write failing repository test**

```swift
// ios/Tests/MdEditorSyncTests/DocumentLibraryRepositoryTests.swift
import XCTest
@testable import MdEditorSync

final class DocumentLibraryRepositoryTests: XCTestCase {
    func testSaveLocalDocumentCreatesPendingUpload() {
        let repository = InMemoryDocumentLibraryRepository()

        repository.saveLocalDocument(
            documentId: "doc_1",
            workspaceId: "wks_1",
            title: "Note",
            markdown: "# Note",
            baseVersionId: "ver_1"
        )

        XCTAssertEqual(repository.documents().count, 1)
        XCTAssertEqual(repository.pendingUploads().count, 1)
        XCTAssertEqual(repository.pendingUploads().first?.documentId, "doc_1")
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd ios && swift test --filter DocumentLibraryRepositoryTests`  
Expected: FAIL because repository types do not exist.

- [ ] **Step 3: Add models and repository**

```swift
// ios/Sources/MdEditorSync/Data/DocumentModels.swift
import Foundation

public struct DocumentRecord: Equatable {
    public let documentId: String
    public let workspaceId: String
    public let title: String
    public let localFileName: String
    public let currentVersionId: String?
    public let conflictStatus: String
}

public struct SyncQueueRecord: Equatable {
    public let documentId: String
    public let workspaceId: String
    public let baseVersionId: String?
    public let contentHash: String
    public let status: String
}
```

```swift
// ios/Sources/MdEditorSync/Data/DocumentLibraryRepository.swift
import Foundation

public protocol DocumentLibraryRepository {
    func saveLocalDocument(documentId: String, workspaceId: String, title: String, markdown: String, baseVersionId: String?)
    func documents() -> [DocumentRecord]
    func pendingUploads() -> [SyncQueueRecord]
}

public final class InMemoryDocumentLibraryRepository: DocumentLibraryRepository {
    private var storedDocuments: [DocumentRecord] = []
    private var storedQueue: [SyncQueueRecord] = []

    public init() {}

    public func saveLocalDocument(documentId: String, workspaceId: String, title: String, markdown: String, baseVersionId: String?) {
        storedDocuments.removeAll { $0.documentId == documentId }
        storedDocuments.append(DocumentRecord(
            documentId: documentId,
            workspaceId: workspaceId,
            title: title,
            localFileName: "\(documentId).md",
            currentVersionId: baseVersionId,
            conflictStatus: "none"
        ))
        storedQueue.append(SyncQueueRecord(
            documentId: documentId,
            workspaceId: workspaceId,
            baseVersionId: baseVersionId,
            contentHash: String(markdown.hashValue),
            status: "pending"
        ))
    }

    public func documents() -> [DocumentRecord] {
        storedDocuments
    }

    public func pendingUploads() -> [SyncQueueRecord] {
        storedQueue
    }
}
```

- [ ] **Step 4: Verify**

Run: `cd ios && swift test --filter DocumentLibraryRepositoryTests`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/Sources/MdEditorSync/Data ios/Tests/MdEditorSyncTests/DocumentLibraryRepositoryTests.swift
git commit -m "feat: add ios local document library model"
```

### Task 4: Auth Repository and Login View Model

**Files:**
- Create: `ios/Sources/MdEditorSync/Auth/AuthRepository.swift`
- Create: `ios/Sources/MdEditorSync/Auth/LoginViewModel.swift`
- Test: `ios/Tests/MdEditorSyncTests/LoginViewModelTests.swift`

- [ ] **Step 1: Write failing login view model test**

```swift
// ios/Tests/MdEditorSyncTests/LoginViewModelTests.swift
import XCTest
@testable import MdEditorSync

final class LoginViewModelTests: XCTestCase {
    func testSuccessfulLoginStoresSession() async throws {
        let tokenStore = InMemoryTokenStore()
        let repository = FakeAuthRepository()
        let viewModel = LoginViewModel(authRepository: repository, tokenStore: tokenStore)

        try await viewModel.login(email: "user@example.com", password: "correct horse battery staple")

        XCTAssertEqual(tokenStore.load()?.userId, "usr_1")
        XCTAssertEqual(viewModel.state, .signedIn)
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd ios && swift test --filter LoginViewModelTests`  
Expected: FAIL because auth repository and ViewModel types do not exist.

- [ ] **Step 3: Add repository and ViewModel**

```swift
// ios/Sources/MdEditorSync/Auth/AuthRepository.swift
import Foundation

public protocol AuthRepository {
    func login(email: String, password: String) async throws -> SessionTokens
}

public enum AuthError: Error, Equatable {
    case invalidEmail
    case weakPassword
}

public final class FakeAuthRepository: AuthRepository {
    public init() {}

    public func login(email: String, password: String) async throws -> SessionTokens {
        if !email.contains("@") {
            throw AuthError.invalidEmail
        }
        if password.count < 12 {
            throw AuthError.weakPassword
        }
        return SessionTokens(accessToken: "access.jwt", refreshToken: "refresh.token", userId: "usr_1", deviceId: "dev_1")
    }
}
```

```swift
// ios/Sources/MdEditorSync/Auth/LoginViewModel.swift
import Foundation

public enum LoginState: Equatable {
    case signedOut
    case signingIn
    case signedIn
    case failed(String)
}

@MainActor
public final class LoginViewModel {
    private let authRepository: AuthRepository
    private let tokenStore: TokenStore

    public private(set) var state: LoginState = .signedOut

    public init(authRepository: AuthRepository, tokenStore: TokenStore) {
        self.authRepository = authRepository
        self.tokenStore = tokenStore
    }

    public func login(email: String, password: String) async throws {
        state = .signingIn
        do {
            let tokens = try await authRepository.login(email: email, password: password)
            tokenStore.save(tokens)
            state = .signedIn
        } catch {
            state = .failed(String(describing: error))
            throw error
        }
    }
}
```

- [ ] **Step 4: Verify**

Run: `cd ios && swift test --filter LoginViewModelTests`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/Sources/MdEditorSync/Auth ios/Tests/MdEditorSyncTests/LoginViewModelTests.swift
git commit -m "feat: add ios login state flow"
```

## Plan Self-Review

- Spec coverage: iOS native scaffold, Codable contract models, token storage boundary, local document library, offline queue, and login state are covered.
- Marker scan: no unresolved markers remain.
- Type consistency: field names and IDs align with the backend contract and design document.
