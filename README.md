# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f2f1a939-c2fa-48c7-959d-8758351cf789

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f2f1a939-c2fa-48c7-959d-8758351cf789) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f2f1a939-c2fa-48c7-959d-8758351cf789) and click on Share -> Publish.

## How to run with Docker

This application can be containerized and run using Docker. Follow these steps:

### Prerequisites

- Docker installed on your system ([Install Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/))
- Docker Compose (included with Docker Desktop)

### Quick Start - PowerShell

**Option 1: Using Docker Compose (Recommended)**

```powershell
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

The application will be available at:
- **Local computer**: `http://localhost:3000`
- **Android phone/emulator on same network**: `http://YOUR_COMPUTER_IP:3000`
  - Find your IP: `ipconfig` (look for IPv4 Address, usually starts with 192.168.x.x)
  - Example: `http://192.168.100.102:3000`

**Option 2: Using Docker directly**

```powershell
# Build the Docker image
docker build -t draw-sign-pro .

# Run the container
docker run -d -p 3000:80 --name draw-sign-pro draw-sign-pro

# View logs
docker logs -f draw-sign-pro

# Stop the container
docker stop draw-sign-pro
docker rm draw-sign-pro

# Or stop and remove in one command
docker rm -f draw-sign-pro
```

### Docker Configuration

The Docker setup uses a multi-stage build:
1. **Build stage**: Uses Node.js to install dependencies and build the application
2. **Production stage**: Uses nginx to serve the static files

### Customization

- **Change port**: Edit `docker-compose.yml` and modify the port mapping (e.g., `"8080:80"` to use port 8080)
- **Nginx configuration**: Modify `nginx.conf` to adjust server settings
- **Build arguments**: Add build arguments to the Dockerfile if needed

### Health Check

The container includes a health check endpoint at `/health`. You can verify the container is running:

**PowerShell:**
```powershell
# Using Invoke-WebRequest
Invoke-WebRequest -Uri http://localhost:3000/health

# Or using curl (if available)
curl http://localhost:3000/health
```

**Browser:**
Simply navigate to `http://localhost:3000/health` in your browser

### Accessing from Android Phone/Emulator

**To access the Docker container from an Android device:**

1. **Find your computer's IP address:**
   ```powershell
   ipconfig
   # Look for "IPv4 Address" under your active network adapter
   # Usually something like: 192.168.1.100 or 192.168.100.102
   ```

2. **Make sure both devices are on the same Wi-Fi network**

3. **Run Docker container:**
   ```powershell
   docker-compose up -d
   ```

4. **Configure Windows Firewall (if needed):**
   ```powershell
   # Allow incoming connections on port 3000
   New-NetFirewallRule -DisplayName "Docker App Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

5. **Access from Android:**
   - Open Chrome or any browser on your Android phone/emulator
   - Navigate to: `http://YOUR_COMPUTER_IP:3000`
   - Example: `http://192.168.100.102:3000`

**For Android Emulator:**
- Use `10.0.2.2` instead of your computer's IP (this is the emulator's special IP for host machine)
- Example: `http://10.0.2.2:3000`

**For Physical Android Device:**
- Use your computer's actual IP address (from `ipconfig`)
- Make sure your phone and computer are on the same Wi-Fi network
- Example: `http://192.168.100.102:3000`

### Useful Docker Commands

```powershell
# View running containers
docker ps

# View all containers (including stopped)
docker ps -a

# View container logs
docker logs draw-sign-pro

# Follow logs in real-time
docker logs -f draw-sign-pro

# Execute commands inside the container
docker exec -it draw-sign-pro sh

# View container resource usage
docker stats draw-sign-pro

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune
```

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## How to run with Android Emulator

This app uses **Capacitor** to run as a native Android app. Follow these steps to run it on an Android emulator:

### Prerequisites

1. **Install Android Studio**
   - Download from [https://developer.android.com/studio](https://developer.android.com/studio)
   - During installation, make sure to install:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (AVD)

2. **Set up Android SDK**
   - Open Android Studio
   - Go to `Tools` → `SDK Manager`
   - Install the latest Android SDK Platform
   - Install Android SDK Build-Tools
   - Note your Android SDK path (usually `C:\Users\<YourUser>\AppData\Local\Android\Sdk` on Windows)

3. **Set up Environment Variables (Windows/PowerShell)**
   
   **Using PowerShell (Run as Administrator):**
   ```powershell
   # Set ANDROID_HOME (replace with your actual SDK path)
   $env:ANDROID_HOME = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
   
   # Add to PATH for current session
   $env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools"
   
   # To make it permanent, add to system environment variables:
   [System.Environment]::SetEnvironmentVariable("ANDROID_HOME", $env:ANDROID_HOME, "User")
   [System.Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\tools", "User")
   ```
   
   **Or manually via System Properties:**
   - Press `Win + X` → `System` → `Advanced system settings` → `Environment Variables`
   - Add `ANDROID_HOME` environment variable pointing to your SDK path
   - Add to PATH: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\tools`

4. **Install Java JDK**
   - Install Java JDK 11 or higher
   - Set `JAVA_HOME` environment variable (same way as ANDROID_HOME above)

### Steps to Run

#### Quick Start (Recommended) - PowerShell

1. **Install dependencies** (if not already done):
   ```powershell
   npm install
   ```

2. **Create and start an Android emulator** (see detailed instructions below)

3. **Build, sync, and run the app**:
   ```powershell
   npm run android:run
   ```
   This command will:
   - Build your web app
   - Sync it to the Android project
   - Launch it on the running emulator/device

#### Detailed Steps - PowerShell

1. **Install dependencies**:
   ```powershell
   npm install
   ```

2. **Build the web app**:
   ```powershell
   npm run build
   ```

3. **Sync the web app to Android**:
   ```powershell
   npm run android:sync
   # Or: npx cap sync android
   ```

4. **Create and start an Android emulator**:
   
   **Option A: Using Android Studio (Recommended)**
   - Open Android Studio
   - Click `Tools` → `Device Manager`
   - Click `Create Device`
   - Select a device (e.g., Pixel 5)
   - Select a system image (e.g., Android 13 - API 33)
   - Finish the setup
   - Start the emulator by clicking the ▶️ play button

   **Option B: Using PowerShell Command Line**
   ```powershell
   # List available emulators
   & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
   
   # Start an emulator (replace <emulator_name> with your emulator name)
   & "$env:ANDROID_HOME\emulator\emulator.exe" -avd <emulator_name>
   
   # Or if emulator is in PATH:
   emulator -list-avds
   emulator -avd <emulator_name>
   ```

5. **Run the app on the emulator**:
   
   **Option A: Using npm script (easiest)**
   ```sh
   npm run android:run
   ```

   **Option B: Using Android Studio (Run Native Android App)**
   
   > **Note:** This runs the compiled Android app, not the web dev server. The web app is built and bundled into the Android app.
   
   **Step 1: Build and sync the web app to Android (one-time setup or after web changes)**
   
   > **Run from the ROOT project directory** (where `package.json` is located):
   ```powershell
   # Make sure you're in: C:\Users\Luc\Documents\GitHub\draw-sign-pro
   npm run android:sync
   ```
   This builds your React web app and copies it into the Android project.
   
   **Step 2: Open the Android project in Android Studio**
   
   **Method A: Using npm script (Easiest)**
   
   > **Run from the ROOT project directory**:
   ```powershell
   # Make sure you're in: C:\Users\Luc\Documents\GitHub\draw-sign-pro
   npm run android:open
   ```
   This automatically opens Android Studio with the `android` folder.
   
   **Method B: Manual opening**
   - Open Android Studio
   - Click `File` → `Open` (or `Open an Existing Project`)
   - Navigate to: `C:\Users\Luc\Documents\GitHub\draw-sign-pro\android`
   - **Important:** Select the `android` folder, NOT the root project folder
   - Click `OK`
   
   **Step 3: Wait for Gradle sync**
   - Android Studio will automatically start syncing the project
   - You'll see "Gradle Sync" progress in the bottom status bar
   - Wait for it to complete (may take a few minutes on first open)
   - If you see errors, check the troubleshooting section below
   
   **Step 4: Start an Android Emulator**
   - In Android Studio, click `Tools` → `Device Manager` (or the device icon in the toolbar)
   - If you have an existing emulator, click the ▶️ play button next to it
   - If you don't have an emulator:
     - Click `Create Device`
     - Select a device (e.g., Pixel 5)
     - Select a system image (e.g., Android 13 - API 33)
     - Finish the setup and start it
   - Wait for the emulator to fully boot (you'll see the Android home screen)
   
   **Step 5: Run the Android app**
   - Make sure an emulator is running (you should see it in the device dropdown at the top toolbar)
   - Click the green ▶️ **Run** button in the toolbar (or press `Shift+F10`)
   - Or go to `Run` → `Run 'app'`
   - Select your running emulator from the device list if prompted
   - Android Studio will:
     1. Build the Android app (APK)
     2. Install it on the emulator
     3. Launch the app automatically
   
   **Step 6: View the app and debug**
   - The app will launch on the emulator
   - You can see logs in the `Logcat` tab at the bottom of Android Studio
   - Use breakpoints in Java/Kotlin code for debugging
   - The web app code (React/TypeScript) runs inside a WebView in the Android app
   
   **After making web app changes:**
   - If you change React/TypeScript code, you need to rebuild and sync:
     ```powershell
     npm run android:sync
     ```
   - Then in Android Studio, click Run again (or press `Shift+F10`)
   - The updated web app will be bundled into the Android app

   **Option C: Using PowerShell Command Line (Gradle directly)**
   
   > **Run from INSIDE the android folder**:
   ```powershell
   # Navigate to the android folder
   cd android
   
   # Run the app (make sure emulator is running first)
   .\gradlew.bat installDebug
   
   # Or use adb directly (from anywhere, as long as adb is in PATH)
   adb install android\app\build\outputs\apk\debug\app-debug.apk
   ```
   
   **Note:** When using Gradle directly, you must be inside the `android` folder. For npm commands, stay in the root project directory.

   **Option D: Using Capacitor CLI**
   ```sh
   npx cap run android
   ```

## How to Build Android APK Using Docker

You can build the Android APK using Docker without installing Android SDK, Java, or Gradle on your computer!

### Prerequisites

- Docker installed ([Install Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/))
- Docker Compose (included with Docker Desktop)

### Build APK with Docker

**Step 1: Build the APK using Docker**
```powershell
# Build the Android APK in Docker
docker-compose -f docker-compose.android.yml build

# Run the build (this will create the APK)
docker-compose -f docker-compose.android.yml run --rm android-builder
```

**Step 2: Find your APK**
After the build completes, the APK will be at:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

**Step 3: Install on your Android phone**

**Option A: Transfer via USB**
1. Connect your phone to your computer via USB
2. Copy `android\app\build\outputs\apk\debug\app-debug.apk` to your phone
3. On your phone, open the APK file
4. Allow installation from unknown sources if prompted
5. Tap "Install"

**Option B: Install directly via ADB**
```powershell
# Make sure your phone is connected and USB debugging is enabled
adb devices

# Install the APK
adb install android\app\build\outputs\apk\debug\app-debug.apk

# Launch the app
adb shell am start -n app.lovable.f2f1a939c2fa48c7959d8758351cf789/.MainActivity
```

**Option C: Transfer via email/cloud**
1. Email the APK to yourself or upload to cloud storage
2. Download on your phone
3. Open and install

### Rebuild APK After Code Changes

```powershell
# Rebuild everything (web app + Android APK)
docker-compose -f docker-compose.android.yml build --no-cache
docker-compose -f docker-compose.android.yml run --rm android-builder
```

### Troubleshooting Docker Android Build

- **Build fails with "sdkmanager not found":**
  - The Docker image needs to be rebuilt: `docker-compose -f docker-compose.android.yml build --no-cache`

- **APK not found after build:**
  - Check that the volume mount is working
  - Look in `android\app\build\outputs\apk\debug\` directory

- **Out of memory errors:**
  - Increase Docker Desktop memory: Settings → Resources → Memory (set to at least 4GB)

### Available npm scripts

- `npm run android:sync` - Build the web app and sync to Android
- `npm run android:run` - Build, sync, and run on Android emulator/device
- `npm run android:open` - Open the Android project in Android Studio
- `npm run android:dev` - Run with live reload (requires dev server running)

### Development Workflow - PowerShell

For development with live reload:

1. **PowerShell Terminal 1 - Run dev server**:
   ```powershell
   npm run dev
   ```

2. **PowerShell Terminal 2 - Run on emulator**:
   ```powershell
   npm run android:dev
   # Or: npx cap run android --livereload --external
   ```

   This will automatically rebuild and reload the app when you make changes.

### Troubleshooting - PowerShell

- **"command not found: adb"**: 
  ```powershell
  # Verify ANDROID_HOME is set
  $env:ANDROID_HOME
  # Verify adb is accessible
  & "$env:ANDROID_HOME\platform-tools\adb.exe" version
  # If not in PATH, add it:
  $env:PATH += ";$env:ANDROID_HOME\platform-tools"
  ```

- **"command not found: emulator"**: 
  ```powershell
  # Use full path or add to PATH
  & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
  ```

- **Gradle build fails - Java version mismatch**: 
  
  **Error: "Cannot find a Java installation matching languageVersion=21"**
  
  Gradle 8.11.1 requires Java 21, but you may have Java 17 installed. Solutions:
  
  **Option 1: Install Java 21 (Recommended)**
  ```powershell
  # Download Java 21 from: https://adoptium.net/temurin/releases/?version=21
  # Or use Chocolatey:
  choco install temurin21jdk
  
  # Set JAVA_HOME to Java 21
  $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot"  # Adjust path
  ```
  
  **Option 2: Let Gradle auto-download Java 21**
  - The `gradle.properties` file is already configured for auto-download
  - Just run the build again and Gradle will download Java 21 automatically
  
  **Option 3: Use existing Java and set JAVA_HOME**
  ```powershell
  # Find your Java installation
  java -version
  where.exe java
  
  # Set JAVA_HOME (replace with your actual Java path)
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-17"  # For Java 17
  # Note: Java 17 may not work with Gradle 8.11.1 - Java 21 is recommended
  ```

- **Emulator won't start**: Check that virtualization is enabled in BIOS (Intel VT-x or AMD-V)

- **App crashes on startup**: Make sure you've run `npm run build` and `npx cap sync android` before running

- **Changes not appearing**: Run `npm run build` then `npx cap sync android` to sync changes

- **PowerShell script execution errors**: If you get execution policy errors, run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

- **App deployment stuck/hanging**: If deployment takes more than 2-3 minutes:
  
  **Step 1: Cancel and check emulator**
  - Press `Ctrl+C` in the terminal to cancel
  - Check if the emulator is responsive (try clicking on it)
  - If emulator is frozen, restart it:
    - Close the emulator window
    - In Android Studio: `Tools` → `Device Manager` → Start the emulator again
  
  **Step 2: Check device connection**
  ```powershell
  # Check if device is connected
  adb devices
  # If no devices, restart adb:
  adb kill-server
  adb start-server
  adb devices
  ```
  
  **Step 3: Try manual installation**
  ```powershell
  # Navigate to android folder
  cd android
  
  # Build the APK
  .\gradlew.bat assembleDebug
  
  # Install manually (replace with your device ID from 'adb devices')
  adb install -r app\build\outputs\apk\debug\app-debug.apk
  
  # Or launch the app directly
  adb shell am start -n app.lovable.f2f1a939c2fa48c7959d8758351cf789/.MainActivity
  ```
  
  **Step 4: If APK is too large** (check size):
  ```powershell
  # Check APK size
  (Get-Item android\app\build\outputs\apk\debug\app-debug.apk).Length / 1MB
  ```
  If it's very large (>50MB), consider:
  - The WASM file (21MB) might be causing slow installation
  - Try using a physical device instead of emulator
  - Enable ProGuard/R8 to reduce size (advanced)