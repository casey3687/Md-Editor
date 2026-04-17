# Android Client Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a native Kotlin Android client with email login, secure token storage boundary, local Markdown document library, offline saves, sync queue persistence, and conflict visibility.

**Architecture:** Add a standalone `android/` project. Keep backend communication behind API/repository classes that mirror the OpenAPI contract, and keep storage behind interfaces so Room and Android Keystore can be added without changing feature code.

**Tech Stack:** Kotlin, Android Gradle Plugin, Jetpack Compose, Room boundary, Android Keystore boundary, OkHttp boundary, Kotlinx Serialization, JUnit.

---

### Task 1: Scaffold Android Project and API Models

**Files:**
- Create: `android/settings.gradle.kts`
- Create: `android/build.gradle.kts`
- Create: `android/app/build.gradle.kts`
- Create: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/java/com/mdeditor/sync/api/AuthModels.kt`
- Test: `android/app/src/test/java/com/mdeditor/sync/api/AuthModelsTest.kt`

- [ ] **Step 1: Write failing model serialization test**

```kotlin
// android/app/src/test/java/com/mdeditor/sync/api/AuthModelsTest.kt
package com.mdeditor.sync.api

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class AuthModelsTest {
    @Test
    fun loginRequestUsesBackendFieldNames() {
        val json = Json.encodeToString(
            LoginRequest.serializer(),
            LoginRequest(
                email = "user@example.com",
                password = "correct horse battery staple",
                deviceName = "Pixel",
                platform = "android",
            ),
        )
        assertEquals(
            """{"email":"user@example.com","password":"correct horse battery staple","device_name":"Pixel","platform":"android"}""",
            json,
        )
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.api.AuthModelsTest`  
Expected: FAIL because Android project files do not exist.

- [ ] **Step 3: Add Gradle project**

```kotlin
// android/settings.gradle.kts
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MdEditorAndroid"
include(":app")
```

```kotlin
// android/build.gradle.kts
plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "2.0.21" apply false
}
```

```kotlin
// android/app/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.mdeditor"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mdeditor"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation("junit:junit:4.13.2")
}
```

- [ ] **Step 4: Add manifest and models**

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:label="Md Editor" />
</manifest>
```

```kotlin
// android/app/src/main/java/com/mdeditor/sync/api/AuthModels.kt
package com.mdeditor.sync.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
    @SerialName("device_name") val deviceName: String,
    val platform: String,
)

@Serializable
data class TokenPairResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in_seconds") val expiresInSeconds: Long,
    @SerialName("user_id") val userId: String,
    @SerialName("device_id") val deviceId: String,
)
```

- [ ] **Step 5: Verify**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.api.AuthModelsTest`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add android
git commit -m "feat: scaffold native android sync client"
```

### Task 2: Token Store Boundary

**Files:**
- Create: `android/app/src/main/java/com/mdeditor/sync/auth/TokenStore.kt`
- Test: `android/app/src/test/java/com/mdeditor/sync/auth/TokenStoreTest.kt`

- [ ] **Step 1: Write failing token store test**

```kotlin
// android/app/src/test/java/com/mdeditor/sync/auth/TokenStoreTest.kt
package com.mdeditor.sync.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class TokenStoreTest {
    @Test
    fun inMemoryTokenStoreSavesLatestSession() {
        val store = InMemoryTokenStore()
        store.save(SessionTokens("access", "refresh", "usr_1", "dev_1"))
        assertEquals(SessionTokens("access", "refresh", "usr_1", "dev_1"), store.load())
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.auth.TokenStoreTest`  
Expected: FAIL because token store types do not exist.

- [ ] **Step 3: Add token store abstraction**

```kotlin
// android/app/src/main/java/com/mdeditor/sync/auth/TokenStore.kt
package com.mdeditor.sync.auth

data class SessionTokens(
    val accessToken: String,
    val refreshToken: String,
    val userId: String,
    val deviceId: String,
)

interface TokenStore {
    fun save(tokens: SessionTokens)
    fun load(): SessionTokens?
    fun clear()
}

class InMemoryTokenStore : TokenStore {
    private var tokens: SessionTokens? = null

    override fun save(tokens: SessionTokens) {
        this.tokens = tokens
    }

    override fun load(): SessionTokens? = tokens

    override fun clear() {
        tokens = null
    }
}
```

Use this boundary for tests. The production implementation stores refresh tokens with Android Keystore-backed encrypted storage.

- [ ] **Step 4: Verify**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.auth.TokenStoreTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/mdeditor/sync/auth android/app/src/test/java/com/mdeditor/sync/auth
git commit -m "feat: add android session token store boundary"
```

### Task 3: Local Document Library and Sync Queue

**Files:**
- Create: `android/app/src/main/java/com/mdeditor/sync/data/DocumentEntity.kt`
- Create: `android/app/src/main/java/com/mdeditor/sync/data/SyncQueueEntity.kt`
- Create: `android/app/src/main/java/com/mdeditor/sync/data/DocumentLibraryRepository.kt`
- Test: `android/app/src/test/java/com/mdeditor/sync/data/DocumentLibraryRepositoryTest.kt`

- [ ] **Step 1: Write failing repository test**

```kotlin
// android/app/src/test/java/com/mdeditor/sync/data/DocumentLibraryRepositoryTest.kt
package com.mdeditor.sync.data

import org.junit.Assert.assertEquals
import org.junit.Test

class DocumentLibraryRepositoryTest {
    @Test
    fun savesDocumentAndQueuesUpload() {
        val repository = InMemoryDocumentLibraryRepository()
        repository.saveLocalDocument(
            documentId = "doc_1",
            workspaceId = "wks_1",
            title = "Note",
            markdown = "# Note",
            baseVersionId = "ver_1",
        )

        assertEquals(1, repository.documents().size)
        assertEquals(1, repository.pendingUploads().size)
        assertEquals("doc_1", repository.pendingUploads().single().documentId)
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.data.DocumentLibraryRepositoryTest`  
Expected: FAIL because repository types do not exist.

- [ ] **Step 3: Add models and repository**

```kotlin
// android/app/src/main/java/com/mdeditor/sync/data/DocumentEntity.kt
package com.mdeditor.sync.data

data class DocumentEntity(
    val documentId: String,
    val workspaceId: String,
    val title: String,
    val localFileName: String,
    val currentVersionId: String?,
    val conflictStatus: String,
)
```

```kotlin
// android/app/src/main/java/com/mdeditor/sync/data/SyncQueueEntity.kt
package com.mdeditor.sync.data

data class SyncQueueEntity(
    val documentId: String,
    val workspaceId: String,
    val baseVersionId: String?,
    val contentHash: String,
    val status: String,
)
```

```kotlin
// android/app/src/main/java/com/mdeditor/sync/data/DocumentLibraryRepository.kt
package com.mdeditor.sync.data

interface DocumentLibraryRepository {
    fun saveLocalDocument(documentId: String, workspaceId: String, title: String, markdown: String, baseVersionId: String?)
    fun documents(): List<DocumentEntity>
    fun pendingUploads(): List<SyncQueueEntity>
}

class InMemoryDocumentLibraryRepository : DocumentLibraryRepository {
    private val documents = mutableListOf<DocumentEntity>()
    private val queue = mutableListOf<SyncQueueEntity>()

    override fun saveLocalDocument(documentId: String, workspaceId: String, title: String, markdown: String, baseVersionId: String?) {
        documents.removeAll { it.documentId == documentId }
        documents.add(DocumentEntity(documentId, workspaceId, title, "$documentId.md", baseVersionId, "none"))
        queue.add(SyncQueueEntity(documentId, workspaceId, baseVersionId, markdown.hashCode().toString(), "pending"))
    }

    override fun documents(): List<DocumentEntity> = documents.toList()
    override fun pendingUploads(): List<SyncQueueEntity> = queue.toList()
}
```

- [ ] **Step 4: Verify**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.data.DocumentLibraryRepositoryTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/mdeditor/sync/data android/app/src/test/java/com/mdeditor/sync/data
git commit -m "feat: add android local document library model"
```

### Task 4: Auth Repository and Login State

**Files:**
- Create: `android/app/src/main/java/com/mdeditor/sync/auth/AuthRepository.kt`
- Create: `android/app/src/main/java/com/mdeditor/sync/auth/LoginViewModel.kt`
- Test: `android/app/src/test/java/com/mdeditor/sync/auth/LoginViewModelTest.kt`

- [ ] **Step 1: Write failing login state test**

```kotlin
// android/app/src/test/java/com/mdeditor/sync/auth/LoginViewModelTest.kt
package com.mdeditor.sync.auth

import org.junit.Assert.assertEquals
import org.junit.Test

class LoginViewModelTest {
    @Test
    fun successfulLoginStoresSession() {
        val tokenStore = InMemoryTokenStore()
        val repository = FakeAuthRepository()
        val viewModel = LoginViewModel(repository, tokenStore)

        viewModel.login("user@example.com", "correct horse battery staple")

        assertEquals("usr_1", tokenStore.load()?.userId)
        assertEquals("signed_in", viewModel.state)
    }
}
```

- [ ] **Step 2: Run test and verify it fails**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.auth.LoginViewModelTest`  
Expected: FAIL because repository and ViewModel do not exist.

- [ ] **Step 3: Add repository and ViewModel**

```kotlin
// android/app/src/main/java/com/mdeditor/sync/auth/AuthRepository.kt
package com.mdeditor.sync.auth

interface AuthRepository {
    fun login(email: String, password: String): SessionTokens
}

class FakeAuthRepository : AuthRepository {
    override fun login(email: String, password: String): SessionTokens {
        require(email.contains("@")) { "email must contain @" }
        require(password.length >= 12) { "password must be at least 12 characters" }
        return SessionTokens("access.jwt", "refresh.token", "usr_1", "dev_1")
    }
}
```

```kotlin
// android/app/src/main/java/com/mdeditor/sync/auth/LoginViewModel.kt
package com.mdeditor.sync.auth

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val tokenStore: TokenStore,
) {
    var state: String = "signed_out"
        private set

    fun login(email: String, password: String) {
        state = "signing_in"
        val tokens = authRepository.login(email, password)
        tokenStore.save(tokens)
        state = "signed_in"
    }
}
```

- [ ] **Step 4: Verify**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests com.mdeditor.sync.auth.LoginViewModelTest`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/mdeditor/sync/auth android/app/src/test/java/com/mdeditor/sync/auth
git commit -m "feat: add android login state flow"
```

## Plan Self-Review

- Spec coverage: Android native scaffold, auth models, token boundary, local document library, sync queue, and login state are covered.
- Marker scan: no unresolved markers remain.
- Type consistency: `documentId`, `workspaceId`, token fields, and platform value map to the backend contract.
