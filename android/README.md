# SilentSOS — Native Android Application

Native Android implementation of **SilentSOS** built with **Kotlin**, **Android SDK**, and a high-performance **Android WebView shell** without using Capacitor, Cordova, Ionic, or React Native.

---

## Architecture Overview

```
Android Native Application (Kotlin)
  │
  ▼
Android WebView (Hardware-accelerated)
  │
  ├── WebChromeClient ──> Camera (getUserMedia), Microphone (audio), Geolocation (GPS), File Uploads
  └── WebViewClient   ──> Route handling, Intent dispatch (tel:, sms:, WhatsApp), Offline recovery
  │
  ▼
SilentSOS React / Vite Web Application (Vercel)
  │
  ▼
SilentSOS Node.js + Express Backend + WebSocket (Render)
  │
  ▼
Neon PostgreSQL Database (Cloud)
```

---

## Prerequisites

1. **Android Studio**: Android Studio Hedgehog (2023.1.1), Jellyfish (2024.1.1), Koala (2024.1.2), or newer.
2. **Java Development Kit (JDK)**: JDK 17 (Temurin / OpenJDK 17).
3. **Android SDK**:
   - `compileSdk`: 34 (Android 14)
   - `targetSdk`: 34
   - `minSdk`: 24 (Android 7.0 Nougat — covers >95% of active Android devices worldwide)
   - Build Tools: `34.0.0` or newer

---

## Project Structure

```
silentsos-workspace/
├── android/
│   ├── app/
│   │   ├── build.gradle                               # App module configuration & dependencies
│   │   ├── proguard-rules.pro                         # Code minification & ProGuard keep rules
│   │   └── src/main/
│   │       ├── AndroidManifest.xml                    # Permissions, Deep Links, FileProvider
│   │       ├── java/com/silentsos/app/
│   │       │   ├── MainActivity.kt                    # WebView lifecycle, permissions, Back nav
│   │       │   ├── SilentSOSWebViewClient.kt          # URL routing, SMS, WhatsApp, error state
│   │       │   ├── SilentSOSWebChromeClient.kt        # Camera, Mic, GPS, and File Chooser bridge
│   │       │   └── NotificationHelper.kt              # Android Notification Channel (API 26+)
│   │       └── res/
│   │           ├── drawable/                          # Vector icons (shield, retry, logo)
│   │           ├── layout/activity_main.xml           # SwipeRefreshLayout, WebView, Error HUD
│   │           ├── mipmap-anydpi-v26/                 # Adaptive app launcher icons
│   │           ├── values/                            # colors.xml, strings.xml, themes.xml
│   │           └── xml/                               # network_security_config.xml, file_paths.xml
│   ├── build.gradle                                   # Root project build file
│   ├── settings.gradle                                # Gradle settings & repository management
│   ├── gradle.properties                              # JVM memory & AndroidX settings
│   ├── local.properties                               # Local SDK path configuration
│   ├── gradlew / gradlew.bat                          # Gradle CLI wrapper scripts
│   └── README.md                                      # Android setup documentation
```

---

## How to Open in Android Studio

1. Launch **Android Studio**.
2. Click **Open** (or `File > Open...`).
3. Select the `android/` directory inside this repository (`silentsos-workspace/android`).
4. Wait for Gradle to finish syncing dependencies.

---

## How to Run on Emulator or Physical Device

### Using Android Studio
1. Select an Android Virtual Device (AVD) or connect a physical phone via USB (with **USB Debugging** enabled in Developer Options).
2. Click the green **Run** button (or press `Shift + F10`).

### Using Command Line (PowerShell / Terminal)
```powershell
cd android

# Install Debug APK directly on connected device:
.\gradlew.bat installDebug
```

---

## Build Commands

### 1. Build Debug APK
```powershell
cd android
.\gradlew.bat assembleDebug
```
* **Output Location**: `android/app/build/outputs/apk/debug/app-debug.apk`

### 2. Build Release APK
```powershell
cd android
.\gradlew.bat assembleRelease
```
* **Output Location**: `android/app/build/outputs/apk/release/app-release.apk`

### 3. Build Android App Bundle (.aab for Google Play Store)
```powershell
cd android
.\gradlew.bat bundleRelease
```
* **Output Location**: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Production URL Configuration

The application loads the live production SilentSOS frontend URL defined in `android/app/build.gradle`:

```groovy
buildConfigField "String", "SILENTSOS_WEB_URL", "\"https://silentsos-6gp250jgo-harsha-vardhan-reddy-s-projects2.vercel.app\""
```

To point to a staging or local server for testing:
1. Update `SILENTSOS_WEB_URL` in `android/app/build.gradle`.
2. Run `.\gradlew.bat assembleDebug`.

---

## Security Configuration

- **Zero Backend Secrets in Android**: The Android app contains **NO** backend credentials, no database passwords, and no API secret keys. It interacts purely via public HTTPS/WSS endpoints.
- **HTTPS Enforcement**: Enforced via `res/xml/network_security_config.xml` (`cleartextTrafficPermitted="false"`).
- **Hardened WebView**: Local file system access (`allowFileAccess = false`) is disabled to prevent arbitrary file execution.
- **Controlled Debugging**: `WebView.setWebContentsDebuggingEnabled` is only enabled in Debug builds (`BuildConfig.DEBUG`).

---

## Google Play Release Signing Setup

For production distribution on the Google Play Store, generate a release keystore:

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore silentsos-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias silentsos
   ```
2. In `android/app/build.gradle`, configure the `signingConfigs.release` block or upload using **Google Play App Signing**.

---

## Known Android WebView Limitations

Because this application operates as a native Android WebView:

1. **Background Camera & Microphone Access**: Modern Android security restrictions suspend WebView camera and microphone tracks when the app is minimized or when the device screen is turned off. Real-time video/photo burst and ambient audio recording function continuously while the app is in the foreground.
2. **Background GPS Updates**: WebView's `navigator.geolocation` can be throttled by Android battery optimization when running in the background for prolonged periods.
3. **Continuous Background Gesture AI**: TensorFlow.js / MediaPipe computer vision requires active screen rendering and camera input, which ceases when the device is locked.

> **Note**: These are standard Android OS privacy safeguards for webview runtimes. If persistent 24/7 background tracking while the phone is locked is required in a future release, a dedicated native Android **Foreground Service** with a persistent notification can be integrated.

---

## Troubleshooting

- **Server Waking Up Screen**: Render instances sleep after inactivity. If the cold start causes a temporary network timeout, the native retry screen will display. Tap **Retry Connection** or pull down to refresh once the server has spun up.
- **Camera/Microphone Permission Not Triggering**: Ensure camera and microphone permissions are granted in Android device settings (`Settings > Apps > SilentSOS > Permissions`).
- **Cleartext HTTP Warning**: The application enforces secure HTTPS for all communications.
