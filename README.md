# VexEdit Studio — Android Offline-First Modular Creative Editor

VexEdit Studio is an offline-first modular video and audio creative studio designed for Android with hybrid editing controls, real-time preview, contextual editing tools, parametric effects lab, audio multi-tracking, and full on-device processing.

---

## Features

- **Offline-First Creative Engine**: 100% on-device timeline evaluation, video/audio processing, effect rendering, and project persistence. No cloud login, online verification, or remote server required.
- **Hybrid Studio UI**: Intuitive mobile-first video editor with high-precision multi-layer timeline, zoomable time ruler, contextual inspector panels (Edit, Speed, Volume, Effects, Animation, Crop), live waveform display, and aspect ratio support (9:16, 16:9, 1:1).
- **Audio Studio**: Multi-track mixing, parametric EQ, compressor, limiter, reverb, delay, distortion, and noise gate.
- **Effects Lab & Presets**: Parametric video filters (vignette, blur, contrast, chromatic aberration, saturation, brightness) with keyframe and preset management.
- **Module Center**: Extensible on-device module management with dependency checking and real progress monitoring.
- **Safe State & Undo/Redo**: Auto-saving, history snapshots, and crash recovery.

---

## Build Instructions

### 1. Web Application (React + Vite + Tailwind CSS)

```bash
# Install dependencies
npm install

# Build production bundle
npm run build
```

The production output is generated in `dist/index.html`.

### 2. Android Native Application (Kotlin + Jetpack Compose + AGP)

Prerequisites:
- **JDK 17** (Temurin / OpenJDK 17)
- **Android SDK** (Compile SDK: 34, Min SDK: 24, Target SDK: 34)
- **Gradle 8.7** with Android Gradle Plugin (AGP) 8.5.2

```bash
# Run unit tests
./gradlew testDebugUnitTest

# Build Debug APK
./gradlew assembleDebug

# Build Release APK (unsigned or signed via Gradle/apksigner)
./gradlew assembleRelease
```

Generated APK paths:
- **Debug APK**: `app/build/outputs/apk/debug/app-debug.apk`
- **Release APK**: `app/build/outputs/apk/release/app-release.apk` (or `vexedit-studio-release-signed.apk`)

---

## GitHub Actions CI/CD Pipeline

The `.github/workflows/android-build.yml` workflow automatically builds, tests, and publishes APK artifacts:

- **Triggers**:
  - Push to `main` and `develop`
  - Pull requests targeting `main` and `develop`
  - Manual triggers via `workflow_dispatch`
  - Tagged releases matching `v*`
- **Steps**:
  1. Sets up JDK 17 with Temurin distribution.
  2. Sets up Gradle 8.7 using official `gradle/actions/setup-gradle@v4` with dependency and build caching.
  3. Automatically accepts Android SDK licenses.
  4. Runs unit tests (`testDebugUnitTest`).
  5. Builds the debug APK and verifies the generated output.
  6. Uploads the debug APK as a downloadable GitHub Actions artifact (`vexedit-studio-debug-<commit-sha>`).
  7. Builds the release APK.
  8. If release signing secrets are provided, signs and verifies the APK using Android `apksigner`.
  9. Uploads the release APK as an artifact.
  10. Automatically attaches APKs to GitHub Releases for `v*` tags.

### Release Signing with GitHub Secrets

To produce signed release APKs in GitHub Actions, configure the following secrets in your repository (**Settings → Secrets and variables → Actions**):

- `KEYSTORE_BASE64`: Base64-encoded `.jks` or `.keystore` file (`base64 -w 0 release.jks`)
- `KEYSTORE_PASSWORD`: Keystore store password
- `KEY_ALIAS`: Keystore key alias name
- `KEY_PASSWORD`: Keystore key password

*If secrets are not configured, the debug APK is still built and uploaded without errors.*

---

## License

- VexEdit Studio Code: [MIT License](LICENSE)
- Third-party components: See [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)
