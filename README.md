# SignDocu — Sign Documents Anywhere

A mobile-first, offline-capable document signing app built with Capacitor, React, and TypeScript. Upload documents (PDF, Word, images), create signatures four different ways, place signature fields (including typed names, dates, initials, and checkboxes), and download signed PDFs — all with biometric security and full offline support.

## Why SignDocu?

| | SignDocu | DocuSign | Adobe Sign | Dropbox Sign |
|---|:---:|:---:|:---:|:---:|
| **Free** | ✅ | ❌ ~$10/mo | ❌ ~$13/mo | ❌ ~$15/mo |
| **Works offline** | ✅ Full | ❌ Limited | ❌ Limited | ❌ No |
| **Word (.docx) support** | ✅ Native | ❌ | ❌ | ❌ |
| **5 field types** | ✅ Sig/Typed/Date/Initials/Checkbox | ✅ Paid tiers | ✅ Paid tiers | ✅ Limited |
| **Biometric lock** | ✅ | ❌ | ❌ | ❌ |
| **Legally binding** | ❌ | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS |
| **Self-hosted** | ✅ | ❌ | ❌ | ❌ |
| **Bundle size** | ~16MB | ~80MB+ | ~120MB+ | ~60MB+ |

> **Legal notice:** SignDocu signatures are **not** legally binding under eIDAS, ESIGN, or UETA. For contracts and legal documents, use a qualified trust service provider. SignDocu is ideal for internal approvals, personal documents, mockups, and workflows where legal compliance is not required.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    SignDocu                      │
├─────────────────────────────────────────────────┤
│  Pages: Index | History | Login | SignUp | 404  │
├─────────────────────────────────────────────────┤
│  Components (8)                                  │
│  ActionBar | DocumentUpload | SignatureCreator   │
│  DocumentViewer | SettingsDialog | ImageCrop     │
│  DocumentScanner | ParticleBackground            │
├─────────────────────────────────────────────────┤
│  Hooks: useSignaturePlacement                    │
├─────────────────────────────────────────────────┤
│  Libraries (14)                                  │
│  ┌─────────────┬──────────────┬───────────────┐ │
│  │ PDF Engine  │ Signatures   │ Security      │ │
│  │ pdfSigner   │ storage      │ biometricLock │ │
│  │ imageSigner │ background   │ supabase      │ │
│  │ ocrFields   │ cameraScan   │ auditTrail    │ │
│  ├─────────────┼──────────────┼───────────────┤ │
│  │ Documents   │ Connectivity │ UX            │ │
│  │ docxConvert │ offlineMode  │ haptics       │ │
│  │ docScanner  │ syncQueue    │ share         │ │
│  │ docHistory  │ pushNotifs   │ confetti      │ │
│  │ templateStr │              │               │ │
│  └─────────────┴──────────────┴───────────────┘ │
├─────────────────────────────────────────────────┤
│  Runtime: Capacitor 7 (Android)                  │
│  Backend:  Supabase (auth, storage, sync)        │
│  Storage:  IndexedDB + Cache API + localStorage  │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
User Input → DocumentUpload → DocumentViewer
                 │                   │
                 ▼                   ▼
            File cached        useSignaturePlacement
            (offline)          (drag/resize/pinch)
                 │                   │
                 ▼                   ▼
          SignatureCreator    SignaturePlacementLayer
          (draw/type/photo)   (field overlays)
                 │                   │
                 ▼                   ▼
          pdfSigner / imageSigner / docxConverter
                 │
                 ▼
          Signed PDF + Audit Certificate
                 │
        ┌────────┴────────┐
        ▼                 ▼
   Download/Share    Supabase Cloud Sync
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 18 + TypeScript 5 | UI and business logic |
| **Build** | Vite 5 | Dev server and production bundling |
| **Styling** | Tailwind CSS 3 + shadcn/ui | Component library and design system |
| **Animations** | Framer Motion 12 | Page transitions, gestures, micro-interactions |
| **Mobile shell** | Capacitor 7 | Native Android app wrapper |
| **PDF viewing** | pdfjs-dist 5 | Render PDF pages in browser |
| **PDF editing** | pdf-lib 1.17 | Embed signatures, text, dates into PDFs |
| **Word docs** | mammoth 1.12 | Client-side .docx → HTML conversion |
| **OCR** | Tesseract.js 4 (lazy-loaded) | Scanned document field detection |
| **Signatures** | react-signature-canvas | Draw signatures with touch/mouse |
| **Auth & DB** | Supabase | Email auth, Postgres, object storage |
| **Offline storage** | IndexedDB + Cache API | Local document and signature caching |
| **Forms** | react-hook-form + zod | Auth form validation |
| **Routing** | react-router-dom 6 | Client-side SPA routing |
| **Icons** | lucide-react | Consistent icon set |

## Quick Start

```bash
git clone <YOUR_GIT_URL>
cd draw-sign-pro
npm install
npm run dev
```

Open `http://localhost:8080` in your browser.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server at port 8080 |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint across the project |
| `npm run android:sync` | Build web + sync to Android project |
| `npm run android:run` | Build, sync, and launch on Android emulator/device |
| `npm run android:open` | Open Android project in Android Studio |
| `npm run android:dev` | Live-reload on connected Android device |

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

If these are not set, SignDocu runs in local-only mode — all data stays on your device.

## Project Structure

```
draw-sign-pro/
├── android/                    # Capacitor Android project
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/           # MainActivity.java
│   │       └── res/            # Icons, values, shortcuts
│   ├── build.gradle
│   └── gradle/
├── public/                     # Static assets
│   ├── manifest.json           # PWA manifest
│   └── robots.txt
├── src/
│   ├── App.tsx                 # Root component + providers + init
│   ├── main.tsx                # React entry point
│   ├── index.css               # Tailwind + custom CSS animations
│   ├── components/
│   │   ├── ActionBar.tsx        # Bottom nav bar + theme toggle
│   │   ├── AuthModal.tsx        # Login/signup modal
│   │   ├── DocumentScanner.tsx  # Native camera document scanner
│   │   ├── DocumentUpload.tsx   # Drag-drop + file picker + scan
│   │   ├── DocumentViewer.tsx   # Doc viewer + field type toolbar
│   │   ├── ImageCropDialog.tsx  # Crop captured photos
│   │   ├── ParticleBackground.tsx # Pure CSS animated background
│   │   ├── ProtectedRoute.tsx   # Auth guard wrapper
│   │   ├── SettingsDialog.tsx   # Biometric lock + cache mgmt
│   │   ├── SignatureCreator.tsx # Draw/type/photo/upload signature
│   │   ├── StepIndicator.tsx    # 4-step progress indicator
│   │   ├── UserMenu.tsx         # Auth state dropdown
│   │   ├── document-viewer/
│   │   │   ├── DocumentRenderer.tsx    # PDF page + image rendering
│   │   │   └── SignaturePlacementLayer.tsx # Field overlays
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/
│   │   └── useSignaturePlacement.ts # Drag/resize/pinch hook
│   ├── lib/
│   │   ├── auditTrail.ts       # SHA-256 cert generation
│   │   ├── AuthContext.tsx      # Supabase auth provider
│   │   ├── backgroundRemoval.ts # Signature image cleanup
│   │   ├── biometricLock.ts     # Capacitor biometric auth
│   │   ├── cameraScan.ts        # Capacitor camera wrapper
│   │   ├── documentActions.ts   # Download/share signed docs
│   │   ├── documentHistory.ts   # Supabase document records
│   │   ├── documentScanner.ts   # Native doc scanner + enhance
│   │   ├── docxConverter.ts     # mammoth .docx → HTML
│   │   ├── haptics.ts           # 6-level haptic feedback
│   │   ├── imageSigner.ts       # Canvas image + fields → PNG
│   │   ├── ocrFields.ts         # Smart field detection
│   │   ├── offlineMode.ts       # Cache API + IndexedDB offline
│   │   ├── pdfSigner.ts         # pdf-lib signature embedding
│   │   ├── pushNotifications.ts # Deferred push permission
│   │   ├── share.ts             # Native share + fallback
│   │   ├── signatureStorage.ts  # IndexedDB + Supabase sync
│   │   ├── supabase.ts          # Supabase client (non-null proxy)
│   │   ├── syncQueue.ts         # Exponential backoff queue
│   │   ├── templateStorage.ts   # Field placement templates
│   │   └── utils.ts             # formatDate + shared helpers
│   └── pages/
│       ├── Index.tsx            # Main signing workflow
│       ├── History.tsx          # Signed document history
│       ├── Login.tsx            # Email login page
│       ├── SignUp.tsx           # Registration page
│       └── NotFound.tsx         # 404 page
├── supabase/
│   ├── functions/               # Edge Functions
│   │   └── send-notification/
│   └── supabase-schema.sql      # Database migrations
├── capacitor.config.ts          # Capacitor configuration
├── Dockerfile                   # Nginx static serve
├── docker-compose.yml           # Docker production
├── docker-compose.android.yml   # Docker Android build
├── nginx.conf                   # Nginx configuration
├── tailwind.config.ts           # Tailwind + custom theme
├── vite.config.ts               # Vite + PWA plugin
└── package.json                 # Dependencies
```

## Docker Deployment

### Web App (Nginx)

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild after changes
docker-compose up -d --build

# Stop
docker-compose down
```

The app runs at `http://localhost:3000`.

Health check: `http://localhost:3000/health`

### Customization

- Change the port in `docker-compose.yml` (e.g., `"8080:80"`)
- Adjust caching and headers in `nginx.conf`

## Building on Android

### Prerequisites

1. **Android Studio** — [Download](https://developer.android.com/studio)
   - Install Android SDK, Platform tools, and an AVD (emulator)
2. **Java JDK 21** — Required by Gradle 8.11+
   - [Download from Adoptium](https://adoptium.net/)
3. **Environment variables** (Windows PowerShell):
   ```powershell
   $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.0.35-hotspot\"
   ```

### Running

```bash
npm install
npm run android:run    # Build, sync, launch on emulator/device
```

### Live Reload Development

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run android:dev
```

### Building APK via Docker

Build the APK without installing Android SDK locally:

```bash
docker-compose -f docker-compose.android.yml build
docker-compose -f docker-compose.android.yml run --rm android-builder
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Installing the APK

```bash
# Via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Launch
adb shell am start -n com.signdocu.app/.MainActivity
```

## Supabase Setup

SignDocu uses Supabase for optional cloud features. The app works fully offline without it.

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) and create a new project.

### 2. Run the Schema

Copy `supabase-schema.sql` into your Supabase SQL Editor and execute it. This creates:

- **`signatures`** table — stores user signatures (data URLs)
- **`documents`** table — stores signed document records
- **`signed-documents`** bucket — secure file storage
- Row-Level Security (RLS) policies on all resources

### 3. Configure Auth

Enable Email auth in Supabase Dashboard → Authentication → Providers.

### 4. Set Environment Variables

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Push Notifications (Optional)

Deploy the Edge Function for push notifications:

```bash
cd supabase/functions/send-notification
supabase functions deploy send-notification
```

## Troubleshooting

### ADB Issues

```powershell
# Restart ADB
adb kill-server
adb start-server
adb devices
```

### Java Version

Gradle 8.11 requires Java 21:

```bash
java -version   # Should show 21.x
```

### Emulator Won't Start

Ensure virtualization is enabled in BIOS (Intel VT-x / AMD-V).

### App Crashes on Startup

Make sure the web build is synced to Android:

```bash
npm run build
npx cap sync android
```

### Changes Not Appearing

Rebuild and re-sync after any web changes:

```bash
npm run build && npx cap sync android
```

### PowerShell Execution Policy (Windows)

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Manual APK Installation

```bash
cd android
./gradlew.bat assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.signdocu.app/.MainActivity
```
