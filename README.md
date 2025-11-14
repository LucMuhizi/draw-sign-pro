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

- Docker installed on your system ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose (usually included with Docker Desktop)

### Quick Start

**Option 1: Using Docker Compose (Recommended)**

```sh
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:3000`

**Option 2: Using Docker directly**

```sh
# Build the Docker image
docker build -t draw-sign-pro .

# Run the container
docker run -d -p 3000:80 --name draw-sign-pro draw-sign-pro

# View logs
docker logs -f draw-sign-pro

# Stop the container
docker stop draw-sign-pro
docker rm draw-sign-pro
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

```sh
curl http://localhost:3000/health
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

3. **Set up Environment Variables (Windows)**
   - Add `ANDROID_HOME` environment variable pointing to your SDK path
   - Add to PATH: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\tools`

4. **Install Java JDK**
   - Install Java JDK 11 or higher
   - Set `JAVA_HOME` environment variable

### Steps to Run

#### Quick Start (Recommended)

1. **Install dependencies** (if not already done):
   ```sh
   npm install
   ```

2. **Create and start an Android emulator** (see detailed instructions below)

3. **Build, sync, and run the app**:
   ```sh
   npm run android:run
   ```
   This command will:
   - Build your web app
   - Sync it to the Android project
   - Launch it on the running emulator/device

#### Detailed Steps

1. **Install dependencies**:
   ```sh
   npm install
   ```

2. **Build the web app**:
   ```sh
   npm run build
   ```

3. **Sync the web app to Android**:
   ```sh
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

   **Option B: Using Command Line**
   ```sh
   # List available emulators
   emulator -list-avds
   
   # Start an emulator (replace <emulator_name> with your emulator name)
   emulator -avd <emulator_name>
   ```

5. **Run the app on the emulator**:
   
   **Option A: Using npm script (easiest)**
   ```sh
   npm run android:run
   ```

   **Option B: Using Android Studio**
   - Open Android Studio
   - Click `File` → `Open`
   - Navigate to your project and select the `android` folder
   - Wait for Gradle sync to complete
   - Click the ▶️ Run button or press `Shift+F10`
   - Select your running emulator from the device list

   **Option C: Using Command Line**
   ```sh
   # Navigate to the android folder
   cd android
   
   # Run the app (make sure emulator is running first)
   # On Windows:
   gradlew.bat installDebug
   # On macOS/Linux:
   ./gradlew installDebug
   
   # Or use adb directly
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

   **Option D: Using Capacitor CLI**
   ```sh
   npx cap run android
   ```

### Available npm scripts

- `npm run android:sync` - Build the web app and sync to Android
- `npm run android:run` - Build, sync, and run on Android emulator/device
- `npm run android:open` - Open the Android project in Android Studio
- `npm run android:dev` - Run with live reload (requires dev server running)

### Development Workflow

For development with live reload:

1. **Terminal 1 - Run dev server**:
   ```sh
   npm run dev
   ```

2. **Terminal 2 - Run on emulator**:
   ```sh
   npm run android:dev
   # Or: npx cap run android --livereload --external
   ```

   This will automatically rebuild and reload the app when you make changes.

### Troubleshooting

- **"command not found: adb"**: Make sure Android SDK platform-tools is in your PATH
- **Gradle build fails**: Make sure you have the correct Java JDK version installed
- **Emulator won't start**: Check that virtualization is enabled in BIOS (Intel VT-x or AMD-V)
- **App crashes on startup**: Make sure you've run `npm run build` and `npx cap sync android` before running
- **Changes not appearing**: Run `npm run build` then `npx cap sync android` to sync changes