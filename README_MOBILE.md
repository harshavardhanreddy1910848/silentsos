# SilentSOS — Android Mobile Build Guide

This guide explains how to install, build, configure, and generate signed APKs or AAB (Android App Bundle) releases for the SilentSOS mobile application.

---

## Folder Structure

The converted mobile application workspace is organized as follows:

```
silentsos-workspace/
├── CNAME
├── README.md
├── README_MOBILE.md                <-- This guide
├── package.json                    <-- Root npm configurations
├── backend/                        <-- Deployed Express server
└── frontend/                       <-- React & Vite Web application
    ├── capacitor.config.ts         <-- Capacitor configuration file
    ├── package.json                <-- Web app dependencies & scripts
    ├── dist/                       <-- Compiled production web assets
    ├── android/                    <-- Native Android Studio Project
    │   ├── app/
    │   │   └── src/
    │   │       └── main/
    │   │           ├── AndroidManifest.xml   <-- Android permissions & hooks
    │   │           └── res/
    │   │               └── mipmap-*/         <-- Launcher Icons
    │   ├── gradlew                 <-- Gradle command-line script (Linux/macOS)
    │   └── gradlew.bat             <-- Gradle command-line script (Windows)
    └── src/
        ├── AppContext.tsx          <-- State provider (Preferences & GPS adapter)
        ├── App.tsx                 <-- Router & loader screen
        ├── hooks/
        │   └── useGeolocation.ts   <-- Location permission hook
        └── utils/
            └── push.ts             <-- Push notification handler
```

---

## Installation & Setup

1. **Prerequisites**:
   - Install **Node.js** (v18 or higher recommended).
   - Install **Java Development Kit (JDK)** (version 17 or higher).
   - Install **Android Studio** (with Android SDK, Command Line Tools, and Build Tools).

2. **Install Workspace Dependencies**:
   Navigate to the root directory and run:
   ```bash
   npm run install:all
   ```
   This will install all root, backend, and frontend packages (including Capacitor and its plugins).

---

## Development Workflow

To run the application locally on an Android device or emulator with live-reloading:

1. Connect your Android device via USB (with Developer Mode and USB Debugging enabled) or start an Android Emulator.
2. Build the web assets:
   ```bash
   npm run build:frontend
   ```
2. Open the project in Android Studio:
   ```bash
   cd frontend
   npx cap open android
   ```
3. Run the development server:
   ```bash
   npm run dev:frontend
   ```
4. Run the app on the connected device:
   ```bash
   npx cap run android
   ```

---

## Build Steps

To compile the latest React web application changes and synchronize them to the Android native package:

1. **Build Frontend Web Assets**:
   ```bash
   cd frontend
   npm run build
   ```
2. **Synchronize with Capacitor**:
   ```bash
   npx cap sync android
   ```

---

## APK & AAB Generation

You can build the Android packages using either **Android Studio** (Recommended) or the **Command Line**.

### Method 1: Using Android Studio (Recommended)

1. Open Android Studio and open the folder `frontend/android` as an existing project.
2. Wait for Gradle sync to complete.

#### Generating a Debug APK (For Testing)
1. In the menu, go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Once the build completes, a popup in the bottom-right corner will show a link to locate the file: `app-debug.apk`.

#### Generating a Signed Release APK / AAB (For Play Store & Distribution)
1. Go to **Build** > **Generate Signed Bundle / APK...**
2. Choose either **Android App Bundle** (AAB for Google Play Store upload) or **APK** (direct distribution/sideloading). Click **Next**.
3. Create a new Keystore or select your existing one:
   - Click **Create new...** if you don't have one. Specify path, password, alias (e.g. `silentsos`), and validity (e.g. 25 years).
4. Enter the key details and password, then click **Next**.
5. Select the **Build Variant** as **`release`**.
6. Select **V4 (Always Enabled)** signature if prompted. Click **Create**.
7. The built binaries will be located under `android/app/release/` or `android/app/build/outputs/`.

---

### Method 2: Using the Command Line (CLI)

From the `frontend/android/` directory:

1. **Debug APK**:
   - **Windows (PowerShell)**:
     ```powershell
     .\gradlew.bat assembleDebug
     ```
   - **Linux / macOS**:
     ```bash
     ./gradlew assembleDebug
     ```
   - The compiled file will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

2. **Unsigned Release APK**:
   - **Windows (PowerShell)**:
     ```powershell
     .\gradlew.bat assembleRelease
     ```
   - **Linux / macOS**:
     ```bash
     ./gradlew assembleRelease
     ```
   - The output file will be at `android/app/build/outputs/apk/release/app-release-unsigned.apk`.

3. **Signing the APK via Command Line**:
   Use `apksigner` (found in the Android SDK build tools, e.g., `%ANDROID_HOME%\build-tools\<version>\apksigner.bat`):
   ```bash
   apksigner sign --ks your-release-key.jks --out app-release-signed.apk app-release-unsigned.apk
   ```
