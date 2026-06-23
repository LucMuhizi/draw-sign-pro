# SignDocu — Sign Documents Anywhere

> A mobile-first, offline-capable document signing app built with **Capacitor 7**, **React 18**, and **TypeScript 5**. Upload PDFs, Word documents, or images. Create signatures four ways. Place five different field types. Download signed PDFs with an audit certificate — all with biometric lock, full offline support, optional Supabase cloud sync, and a Capacitor-wrapped Android build.

<p align="center">
  <b>Free</b> · <b>Offline-first</b> · <b>Native .docx support</b> · <b>Biometric locked</b> · <b>16 MB bundle</b>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Visual Tour](#visual-tour)
- [Feature Catalog](#feature-catalog)
- [Detailed Features](#detailed-features)
  - [Document Input](#1-document-input)
  - [Signature Creation](#2-signature-creation)
  - [Field Types & Placement](#3-field-types--placement)
  - [OCR Field Auto-Detection](#4-ocr-field-auto-detection)
  - [Document Output & Audit Certificate](#5-document-output--audit-certificate)
  - [Templates](#6-templates)
  - [Quick Sign (One-Tap Mode)](#7-quick-sign-one-tap-mode)
  - [Multi-Party Signing](#8-multi-party-signing)
  - [Authentication](#9-authentication)
  - [Offline Mode & Sync Queue](#10-offline-mode--sync-queue)
  - [Cloud Sync (Optional)](#11-cloud-sync-optional)
  - [Push Notifications](#12-push-notifications)
  - [Native Mobile Features](#13-native-mobile-features)
  - [PWA / Install](#14-pwa--install)
  - [Animations](#15-animations)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Available Scripts](#available-scripts)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Running the App](#running-the-app)
  - [Web (Dev Server)](#web-dev-server)
  - [Web (Docker)](#web-docker)
  - [PWA over Local WiFi (zero install)](#pwa-over-local-wi-fi-zero-install)
  - [Android (npm scripts — needs Android Studio + JDK)](#android-npm-scripts--needs-android-studio--jdk)
  - [Android Live Reload over USB](#android-live-reload-over-usb)
  - [Android via Docker (no Android Studio needed)](#android-via-docker-no-android-studio-needed)
  - [Install APK on a Physical Device](#install-apk-on-a-physical-device)
- [Supabase Setup](#supabase-setup)
- [Push Notification Edge Function](#push-notification-edge-function)
- [Multi-Party Setup](#multi-party-setup)
- [Troubleshooting](#troubleshooting)
- [Performance Characteristics](#performance-characteristics)
- [Compliance & Legal Limitations](#compliance--legal-limitations)
- [Roadmap](#roadmap)

---

## Overview

**SignDocu** is a local-first document signing tool. Every signature, every field, every signed document lives on the user's device — no cloud signup required. When Supabase is configured, signatures and signed PDFs optionally sync across a user's devices. The app is wrapped in Capacitor 7 for native Android, with full access to the device camera, biometric prompt, push notifications, native share sheet, and Home Screen install.

### When to use SignDocu

✅ Internal team approvals · personal forms · mockups & design reviews · pre-filling forms · workflows where legal non-repudiation is not required.

### When NOT to use SignDocu

❌ Employment contracts · real estate · financial agreements · government forms requiring certified signatures. SignDocu is **not** legally binding under eIDAS, ESIGN, or UETA. Use a qualified trust service provider.

### Competitive comparison

| | SignDocu | DocuSign | Adobe Sign | Dropbox Sign |
|---|:---:|:---:|:---:|:---:|
| **Price** | Free | ~$10 / mo | ~$13 / mo | ~$15 / mo |
| **Works offline** | ✅ Full | ⚠️ Limited | ⚠️ Limited | ❌ |
| **Word (.docx)** | ✅ Native | ❌ | ❌ | ❌ |
| **5 field types** | ✅ Sig / Typed / Date / Initials / Checkbox | ✅ Paid | ✅ Paid | ⚠️ Limited |
| **Biometric lock** | ✅ | ❌ | ❌ | ❌ |
| **Legally binding** | ❌ | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS |
| **Self-hostable** | ✅ | ❌ | ❌ | ❌ |
| **Bundle size** | ~16 MB | ~80 MB+ | ~120 MB+ | ~60 MB+ |

> For complete competitive analysis and gap analysis, see [SPECS.md — Competitive Analysis](./docs/SPECS.md#competitive-analysis).

---

## Visual Tour

The four-step signing flow, rendered as annotated SVG mockups in [`screenshots/`](./screenshots/). For implementation details on each step, see [`docs/screenshots.md`](./docs/screenshots.md).

### ① Upload — bring any document

![Upload step — drag-drop, file picker, Smart Scan, Quick Photo](./screenshots/01-upload.svg)

Drag-and-drop, file picker, Smart Scan (native camera), and Quick Photo behind a single screen. Accepts `.pdf`, `.docx`, and all common image formats. Works offline — files cache to IndexedDB.

### ② Place fields — drag, drop, OCR

![Place fields — auto-detect, 5 field types, drag/resize/pinch, templates](./screenshots/02-place.svg)

Auto-detect finds signature zones via Tesseract.js. Five native field types (signature, typed name, date, initials, checkbox) render as native PDF objects in the export. Drag to position, pinch to resize, save as a template for reuse.

### ③ Create signature — four methods

![Create signature — draw, type, photo (auto bg removal), upload](./screenshots/03-sign.svg)

Draw with touch or stylus, type with a live font preview, capture a photo (background is removed automatically), or upload an existing image. Every saved signature is reusable across documents.

### ④ Export — audit certificate + share

![Export step — paper-dust burst, SHA-256 audit cert, native share sheet](./screenshots/04-export.svg)

A SHA-256 audit certificate is appended as the final page of every signed PDF. Native share sheet on mobile (Capacitor `@capacitor/share`), Web Share API on desktop, plain download as fallback. A subtle paper-dust burst surfaces the success moment.

---

## Feature Catalog

| # | Feature | File(s) | Description |
|---|---|---|---|
| 1 | Drag-and-drop upload | `src/components/DocumentUpload.tsx` | Animated drop zone with idle / dragging / file-selected states |
| 2 | File picker | `src/components/DocumentUpload.tsx` | Hidden `<input type=file>` with MIME + extension validation |
| 3 | Smart scan (native) | `src/components/DocumentScanner.tsx`, `src/lib/documentScanner.ts` | Edge-detect, perspective-correct, auto-crop via OS-native scanner |
| 4 | Quick photo | `src/lib/cameraScan.ts` | Single-shot photo with manual crop |
| 5 | Draw signature | `src/components/SignatureCreator.tsx` (Draw mode) | HTML5 canvas with touch + mouse support |
| 6 | Type signature | `src/components/SignatureCreator.tsx` (Type mode) | Render text in 4 fonts (serif, script, sans, mono) |
| 7 | Photo signature | `src/components/SignatureCreator.tsx` (Photo mode) | Camera capture with auto background removal |
| 8 | Upload signature | `src/components/SignatureCreator.tsx` (Upload mode) | Image file picker with background cleanup |
| 9 | 5 field types | `src/lib/pdfSigner.ts` | Signature, Typed name, Date, Initials, Checkbox |
| 10 | Drag / resize / pinch | `src/hooks/useSignaturePlacement.ts` | Pointer events + touch two-finger zoom |
| 11 | OCR field auto-detect | `src/lib/ocrFields.ts` | Two-tier: text-extraction fast path, Tesseract OCR fallback |
| 12 | Word (.docx) support | `src/lib/docxConverter.ts` | mammoth.js client-side `.docx → HTML` |
| 13 | Audit certificate | `src/lib/auditTrail.ts` | SHA-256 hash + placement log + signing timestamps appended as final PDF page |
| 14 | Templates | `src/lib/templateStorage.ts` | Save / load / delete field layouts (IndexedDB) |
| 15 | Quick Sign | `src/components/QuickSignOverlay.tsx`, `src/lib/userProfile.ts` | One-tap mode: signature auto-generated from profile + auto-placed |
| 16 | Multi-party signing | `src/lib/multiPartySigning.ts`, `src/components/RecipientManager.tsx` | Sender prepares session, recipients sign via share link |
| 17 | Supabase auth | `src/lib/AuthContext.tsx` | Email / password, RLS-protected rows |
| 18 | Biometric lock | `src/lib/biometricLock.ts` | App-level fingerprint / face unlock |
| 19 | Offline mode | `src/lib/offlineMode.ts` | Cache API + IndexedDB for documents and signatures |
| 20 | Sync queue | `src/lib/syncQueue.ts` | localStorage queue + exponential backoff (1 s → 5 min cap) |
| 21 | Cloud sync | `src/lib/signatureStorage.ts` | Bidirectional sync of saved signatures |
| 22 | Push notifications | `src/lib/pushNotifications.ts` | **Deferred** permission model — only requested after first successful download |
| 23 | Haptic feedback | `src/lib/haptics.ts` | 6 named levels (light, medium, heavy, success, warning, error) |
| 24 | Android document scanner | `@southdevs/capacitor-document-scanner` | Native Auto-capture with multi-page support |
| 25 | Native share | `src/lib/share.ts` | Capacitor Share API with web fallback |
| 26 | Android Home-Screen shortcuts | `android/app/src/main/res/xml/shortcuts.xml` | Sign new / Open last / Camera scan shortcuts |
| 27 | PWA install | `vite-plugin-pwa` + `src/lib/pwaInstall.ts` | Manifest with maskable icons, auto-update service worker |
| 28 | Dark mode | `next-themes` | Light / Dark / System preference |
| 29 | Particle background | `src/components/ParticleBackground.tsx` | Pure CSS animated dots — zero JS overhead |
| 30 | Premium animations | `src/components/animations/*` | Fold-in, ink reveal, completion pulse, auto-advance camera |

---

## Detailed Features

### 1. Document Input

| Method | File | Native? | Web fallback |
|---|---|---|---|
| **Drag & drop** | `src/components/DocumentUpload.tsx` | ✅ | ✅ |
| **File picker** | `src/components/DocumentUpload.tsx` | ✅ | ✅ |
| **Smart scan** | `src/components/DocumentScanner.tsx`, `src/lib/documentScanner.ts` | ✅ (Android) | Hidden |
| **Quick photo** | `src/lib/cameraScan.ts` | ✅ (Capacitor Camera) | `<input capture="environment">` + FileReader |

**Accepted formats**

- PDF: `.pdf`
- Word: `.docx`, `.doc` (best-effort for legacy `.doc`)
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tiff`, `image/*`

**Smart scan pipeline** (Android only — hidden in web build):

1. `@southdevs/capacitor-document-scanner` opens the OS-native scanner
2. Edge detection + perspective correction happen on-device
3. Output is enhanced JPEG (contrast + brightness + saturation)
4. Optional multi-page support — each page becomes a document

**Quick photo flow**:

1. `Camera.getPhoto()` with quality 85, `correctOrientation: true`
2. Returns to `ImageCropDialog.tsx` for manual crop
3. Cropped image is then processed like a normal upload

---

### 2. Signature Creation

Four creation methods in `src/components/SignatureCreator.tsx`, stored locally as PNG data URLs.

| Mode | Plugin / Library | Output |
|---|---|---|
| **Draw** | `react-signature-canvas` v1.1 | `canvas.toDataURL()` → PNG |
| **Type** | Inline canvas renderer | Live preview with serif / script / sans / mono fonts |
| **Photo** | `@capacitor/camera` + `src/lib/backgroundRemoval.ts` | Background-removal pipeline → PNG |
| **Upload** | `<input type=file>` + `backgroundRemoval.ts` | File → background removal → PNG |

**Background removal algorithm** (`src/lib/backgroundRemoval.ts`):

1. Canvas pixel iteration
2. Grayscale conversion (0.299R + 0.587G + 0.114B)
3. Threshold at 200 → set alpha to 0 for light pixels
4. Runs synchronously — acceptable for signature-sized images (< 100 ms)

**Quality controls** (premium-animations pipeline-ready): all signatures are PNG with transparent background so they composite cleanly onto PDF / image / docx output.

---

### 3. Field Types & Placement

Five native field types in `src/lib/pdfSigner.ts`:

| Type | Default size | PDF rendering | Image / Docx rendering |
|---|---|---|---|
| **Signature** | 150 × 60 | Embedded PNG / JPG | Canvas `drawImage` |
| **Typed Name** | 200 × 50 | pdf-lib `drawText` (Helvetica, centered) | Canvas `fillText` (serif) |
| **Date** | 140 × 40 | pdf-lib `drawText` + `formatDate()` | Canvas `fillText` (sans-serif) |
| **Initials** | 80 × 50 | pdf-lib `drawText` (Helvetica Bold, UPPERCASE) | Canvas `fillText` (bold serif) |
| **Checkbox** | 30 × 30 | pdf-lib `drawRectangle` + `drawText('✓')` | Canvas `strokeRect` + `fillText('✓')` |

**Date formatting** (`src/lib/utils.ts → formatDate`):

- Tokens: `MM` (month), `DD` (day), `YYYY` (4-digit year), `YY` (2-digit year)
- Example: `"MM/DD/YYYY"` → `"06/15/2026"`, `"DD/MM/YY"` → `"15/06/26"`

**Placement interactions** (`src/hooks/useSignaturePlacement.ts`):

| Interaction | Implementation |
|---|---|
| **Tap-to-place** | `pointerdown` on container drops field at click location |
| **Drag** | Pointer events + `setPointerCapture` + bounding-rect clamp |
| **Resize** | 4 corner handles + pointer delta math (20 px min width / 15 px min height) |
| **Pinch-to-zoom** | Two-finger `touchmove` → distance ratio scales width + height |
| **Toggle checkbox** | Click handler → state toggle + haptic success / light |
| **Remove** | Red × button on hover (group-hover) + haptic light |

Coordinate space: placements are stored in **screen-space pixels** relative to a wrapper `containerRef`. On export, `pdfSigner.ts` scales by `pdfDimension / renderedDimension` to land the placement at the corresponding PDF point. Y axis is inverted (PDF origin is bottom-left; screen origin is top-left).

---

### 4. OCR Field Auto-Detection

`src/lib/ocrFields.ts` uses a **two-tier** strategy:

#### Fast path — text-extraction (≤ 100 ms / page)

1. Check page 1's text content. If ≥ 50 text items → text-based PDF.
2. For each page: `page.getTextContent()` → iterate items → match against keywords
3. Keywords: `signature`, `sign here`, `sign`, `x`, `authorized`, `approved`, `date`, `title`, `name`
4. Coordinates: PDF transform matrix → viewport → screen-space

#### Slow path — Tesseract OCR (2–8 s / page, scanned PDFs)

1. Render page to canvas at 2× scale
2. Lazy-load `tesseract.js` (`import('tesseract.js')`)
3. `worker.recognize(canvas)` → word-level bounding boxes
4. Match keywords → map bbox back to screen-space with padding

Output is a sequenced reveal animation (see [Animations](#15-animations)) where signature fields appear first, then date, then initials.

---

### 5. Document Output & Audit Certificate

#### PDF signing — `src/lib/pdfSigner.ts`

- Library: `pdf-lib` v1.17
- Pipeline: `PDFDocument.load(bytes)` → for each placement → scale coords (`screenValue × pdfDim / renderedDim`) → `page.drawImage` / `drawText` / `drawRectangle` → `pdfDoc.save()`
- Y-axis flip: `pdfY = pdfHeight − scaled(y + placementHeight)`
- Signature image auto-detected as PNG / JPG

#### Image signing — `src/lib/imageSigner.ts`

- Pipeline: load image at natural resolution → compute scaleX / scaleY → overlay fields at native coords → `canvas.toBlob('image/png')`

#### Word doc output — `src/lib/documentActions.ts`

- Render converted HTML `<div>` to a tall canvas
- Slice into A4-sized pages
- Overlay each placement position
- Compose into a multi-page PDF via `pdf-lib`

#### Audit certificate — `src/lib/auditTrail.ts`

A4 PDF (595.28 × 841.89 pts) generated for every signed document, containing:

- Original file name
- SHA-256 hash of the original file's `ArrayBuffer`
- Field placement log with timestamps
- Signing user identifier (from auth context)
- **Legal disclaimer** explicitly stating the signature is **not** eIDAS / ESIGN / UETA-compliant

`appendCertificateToDocument(pdfBytes, certBytes)` merges the certificate as the **final page** of the signed PDF.

---

### 6. Templates

`src/lib/templateStorage.ts` saves field layouts for reuse on similar documents.

- **Storage**: IndexedDB (via `src/lib/storage.ts` wrapper) under prefix `signdocu-template`
- **Schema** (`DocumentTemplate`): `id`, `name`, `documentName`, `pageCount`, `placements[]` (stripped `SignaturePlacement`), `createdAt`
- **Operations**: `getTemplates()`, `saveTemplate()`, `deleteTemplate()`, `templateToPlacements()`
- **UI**: "Save as Template" button in `DocumentViewer.tsx` toolbar; strip runtime fields (`id`, `checked`) on save

---

### 7. Quick Sign (One-Tap Mode)

A profile-driven flow that collapses the 4-step wizard to **one tap**:

| File | Role |
|---|---|
| `src/lib/userProfile.ts` | IndexedDB-persisted user profile (name, font, position) |
| `src/components/QuickSignOverlay.tsx` | Post-upload bottom sheet, auto-generates signature preview |
| `src/hooks/useSignaturePlacement.ts → autoPlaceDefault()` | Places signature at user's preferred position |

Profile schema (`UserProfile`):

```ts
{
  displayName: "John Doe",
  preferredFont: "cursive" | "serif" | "sans-serif" | "monospace",
  preferredSigColor: "#1a1a1a",
  preferredPosition: { x, y, width, height }, // default: right-aligned, 40px from top
  quickSignEnabled: boolean,
  lastUsedSigId?: string,
}
```

Toggle on/off in `src/components/ActionBar.tsx`.

---

### 8. Multi-Party Signing

A sender can prepare a document for **multiple recipients** to sign independently. Implemented in `src/lib/multiPartySigning.ts`, with UI in `src/components/RecipientManager.tsx` and a dedicated recipient view in `src/pages/SignRecipient.tsx`.

**Schema** (see `supabase-schema.sql`):

- `signing_sessions` — owner, document hash, share token, status (`pending` / `in_progress` / `completed` / `expired`)
- `signing_participants` — email, color, role, status, assigned fields (JSONB)
- RLS: session creator can manage; anyone with the `share_token` can read

**Flow**:

1. Sender opens the document, taps "Multi-Party", adds recipients
2. Each recipient is assigned placements (color-coded via `RecipientBadge`)
3. Sender shares a URL like `https://signdocu.app/sign/{shareToken}`
4. Recipient opens the URL → sees only their fields → signs → status updates via Supabase real-time
5. When everyone has signed, the sender downloads the final document

Offline: signatures queued locally via `syncQueue` and synced when online.

---

### 9. Authentication

#### Supabase Auth — `src/lib/AuthContext.tsx`

- Email / password sign-in, sign-up, sign-out
- Session auto-refresh
- Route protection via `src/components/ProtectedRoute.tsx` (redirects to `/login`)
- Graceful degradation: app works fully without Supabase configured

#### Biometric lock — `src/lib/biometricLock.ts`

- Plugin: `@aparajita/capacitor-biometric-auth` v10
- Capability check (`isBiometricAvailable()`)
- Persisted opt-in (localStorage key: `draw-sign-pro-biometric-lock`)
- Fallback to device credential (`allowDeviceCredential: true`)
- Triggered on app start in `src/pages/Index.tsx`

---

### 10. Offline Mode & Sync Queue

Two layers:

#### Cache API + IndexedDB — `src/lib/offlineMode.ts`

- Documents cached via `caches.open('draw-sign-pro-docs')` as `Response` objects
- Signatures cached in IndexedDB with prefix `signdocu-cached-sig`
- LRU eviction — 5-document cap
- `navigator.onLine` + `online` / `offline` event listeners

#### Sync queue — `src/lib/syncQueue.ts`

- Storage: `localStorage` JSON, max 50 items
- Schedule: recursive `setTimeout` with **exponential backoff**:
  ```
  1s → 2s → 4s → 8s → 16s → 32s → 1m → 2m → 5m (caps)
  ```
- Delay resets to 1 s on success or reconnect
- 5 retries per item → auto-discarded
- Trigger: app start (immediate), reconnect (window `online` event), queued schedule

**Offline UI**: pulsing "Works Offline" badge in `ActionBar.tsx`, solid "Offline Mode" badge when disconnected, and a privacy toast on first visit.

---

### 11. Cloud Sync (Optional)

`src/lib/signatureStorage.ts`:

- `syncLocalToCloud(userId)` — compares local vs cloud by data URL, uploads new
- `fetchCloudSignatures(userId)` — fetches all user signatures, converts to local format
- Triggered on app load when authenticated (`src/pages/Index.tsx → useEffect`)

`src/lib/documentHistory.ts`:

- Records signed documents in Supabase `documents` table on every successful download

---

### 12. Push Notifications

`src/lib/pushNotifications.ts`:

- Plugin: `@capacitor/push-notifications` v7
- **Deferred permission strategy** — never requested at startup. Only requested after the first successful document download. This lowers opt-out rate dramatically.
- Listeners: `pushNotificationReceived` (foreground haptic), `pushNotificationActionPerformed` (app open), `registration` (token refresh)
- Payload supports `documentId` for deep linking

---

### 13. Native Mobile Features

Capacitor plugin matrix (Android-focused, iOS-ready):

| Feature | Plugin | File |
|---|---|---|
| Document scanner (edge-detect) | `@southdevs/capacitor-document-scanner` v7 | `src/lib/documentScanner.ts` |
| Camera capture | `@capacitor/camera` v7 | `src/lib/cameraScan.ts` |
| Native share | `@capacitor/share` v7 | `src/lib/share.ts` |
| Biometric auth | `@aparajita/capacitor-biometric-auth` v10 | `src/lib/biometricLock.ts` |
| Haptic feedback (6 levels) | `@capacitor/haptics` v7 | `src/lib/haptics.ts` |
| Splash screen | `@capacitor/splash-screen` v7 | `src/App.tsx → MobileInit` |
| Status bar | `@capacitor/status-bar` v7 | `src/App.tsx → MobileInit` |
| Keyboard handling | `@capacitor/keyboard` v7 | `src/App.tsx → MobileInit` |
| Push notifications | `@capacitor/push-notifications` v7 | `src/lib/pushNotifications.ts` |
| File system | `@capacitor/filesystem` v7 | `src/lib/storage.ts` |

#### Haptic levels — `src/lib/haptics.ts`

| Function | Use case |
|---|---|
| `hapticLight()` | Button press confirmed |
| `hapticMedium()` | Substantive action (field placed, checkbox toggled) |
| `hapticHeavy()` | Destructive action (delete) |
| `hapticSuccess()` | Win moment (field completion, export success) |
| `hapticWarning()` | Reattention needed |
| `hapticError()` | Failure |

All no-op on web — silent fallback.

#### Android Home-Screen shortcuts

Configured in `android/app/src/main/res/xml/shortcuts.xml`:

1. **Sign New** — opens the upload screen
2. **Open Last** — opens the most recently signed document
3. **Camera Scan** — launches directly into document scanner

---

### 14. PWA / Install

`vite-plugin-pwa` + `src/lib/pwaInstall.ts`:

- Manifest: `name`, `short_name`, `theme_color`, `background_color`, `display: standalone`, `orientation: portrait`
- Icons: 192×192 and 512×512 maskable
- Service worker registers automatically with `autoUpdate` strategy
- Workbox runtime caching: Supabase API (`NetworkFirst` cache, 50 entries / 24 h)
- Ignored from precache: Tesseract WASM, OCR worker
- `beforeinstallprompt` event triggers the custom install banner in `src/lib/pwaInstall.ts`

Install on mobile: open the URL in Chrome → menu → "Add to Home Screen". Standalone launch, no browser chrome.

---

### 15. Animations

Premium animations are powered entirely by **Framer Motion 12** + **CSS keyframes** — no new dependencies. Defined in `src/components/animations/`:

| Component | When it fires | What it does |
|---|---|---|
| `DocumentFoldIn` | First mount of `DocumentViewer` | Scales 0.95 → 1, lifts y+40 → 0, flattens `rotateX 8° → 0` (~450 ms spring) |
| `AIFieldDiscovery` | After auto-detect | Sequenced light sweep → glow → marker fade-in, signature / date / initials order |
| `InkedSignature` | Field rendered with signature | PNG clip-path reveal; vector text uses SVG `strokeDasharray` |
| `SuccessBurst` | Export success | 18 small paper-dust particles drift + fade |
| `PressableButton` | Every primary button | 1 → 0.97 → 1.03 → 1 (anticipation + overshoot) |
| `MultiPartyProgress` | Multi-party session in progress | Sequential avatar fill + connecting line |

All animations respect `prefers-reduced-motion`.

---

## Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | React | 18.3.1 | UI |
| **Language** | TypeScript | 5.8.3 | Type safety |
| **Build** | Vite | 5.4.19 | Dev server + production bundling |
| **Routing** | react-router-dom | 6.30.1 | SPA routing |
| **Styling** | Tailwind CSS | 3.4.17 | Utility CSS |
| **Components** | shadcn/ui + Radix UI | latest | Headless + styled primitives |
| **Icons** | lucide-react | 0.462.0 | Icon set |
| **Animations** | Framer Motion | 12.40 | Page + gesture + micro-interactions |
| **Mobile shell** | Capacitor | 7.4.3 | Android (and iOS-ready) native wrapper |
| **PDF view** | pdfjs-dist | 5.4.296 | Render PDFs |
| **PDF edit** | pdf-lib | 1.17.1 | Embed signatures / text / dates |
| **Word import** | mammoth | 1.12 | Client-side .docx → HTML |
| **OCR** | tesseract.js | 4.1.1 | Scanned PDF field detection (lazy-loaded) |
| **Signature capture** | react-signature-canvas | 1.1.0-alpha.2 | Touch / mouse drawing |
| **Bottom sheets** | vaul | 0.9.9 | Native-style sheets |
| **Forms** | react-hook-form + zod | 7.61 + 3.25 | Auth form validation |
| **Server state** | @tanstack/react-query | 5.83 | Caching + mutations |
| **Auth + DB** | @supabase/supabase-js | 2.108 | Email auth, Postgres, storage |
| **Theme** | next-themes | 0.3 | Light / dark / system |
| **Offline** | IndexedDB + Cache API | — | Documents + signatures |
| **PWA** | vite-plugin-pwa | 1.3 | Manifest + service worker |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    SignDocu                      │
├─────────────────────────────────────────────────┤
│  Pages: Index | History | Login | SignUp |      │
│         Landing | SignRecipient | NotFound      │
├─────────────────────────────────────────────────┤
│  Components (12 core + shadcn/ui primitives)    │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │ Workflow     │  Input       │  Output      │ │
│  │ ActionBar    │  DocumentUp  │  DocumentVw  │ │
│  │ StepIndicat  │  DocScanner  │  Share/      │ │
│  │ BottomSheet  │  ImageCrop   │  Download    │ │
│  └──────────────┴──────────────┴──────────────┘ │
│  + animations/ (InkedSignature, AIFieldDiscov, │
│    SuccessBurst, PressableButton, ...)          │
├─────────────────────────────────────────────────┤
│  Hooks                                           │
│  useSignaturePlacement | usePullToRefresh       │
│  use-mobile | use-toast | (custom)              │
├─────────────────────────────────────────────────┤
│  Libraries (28 modules)                          │
│  ┌─────────────┬──────────────┬───────────────┐ │
│  │ PDF Engine  │ Signatures   │ Security      │ │
│  │ pdfSigner   │ signatureSt. │ biometricLock │ │
│  │ imageSigner │ background   │ AuthContext   │ │
│  │ ocrFields   │ templateSt.  │ auditTrail    │ │
│  │ docxConvert │ userProfile  │               │ │
│  ├─────────────┼──────────────┼───────────────┤ │
│  │ Documents   │ Connectivity │ UX            │ │
│  │ docScanner  │ offlineMode  │ haptics       │ │
│  │ docActions  │ syncQueue    │ share         │ │
│  │ docHistory  │ pushNotifs   │ pwaInstall    │ │
│  │ multiParty  │              │               │ │
│  ├─────────────┴──────────────┴───────────────┤ │
│  │ supabase.ts · utils.ts · storage.ts · utils │ │
│  └────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  Runtime:  Capacitor 7 (Android)                │
│  Backend:  Supabase (auth, storage, sync)        │
│  Storage:  IndexedDB + Cache API + localStorage │
└─────────────────────────────────────────────────┘
```

### Data flow

```
          User uploads file
                 │
                 ▼
        ┌────────────────┐    ┌────────────────┐
        │ DocumentUpload │ →  │ DocumentViewer │
        └────────────────┘    └───────┬────────┘
                  │                   │
            Cache to IndexedDB         ▼
                  │            useSignaturePlacement
                  ▼            (drag/resize/pinch)
            offlineMode          │
                                 ▼
                          SignaturePlacementLayer
                          (field overlays)
                                 │
                                 ▼
                          pdfSigner / imageSigner / docxConverter
                                 │
                                 ▼
                       Signed PDF + Audit Certificate
                                 │
                  ┌──────────────┴──────────────┐
                  ▼                             ▼
          Download / Share             Supabase Cloud Sync
                                                  │
                                                  ▼
                                          syncQueue (backoff)
```

### State management

Distributed — no central store. State locality is chosen per concern:

| State | Location | Persistence |
|---|---|---|
| Auth session | `AuthContext` | Supabase + localStorage |
| Active signature | `Index.tsx` | None (ephemeral) |
| Selected file | `Index.tsx` | Cache API |
| Field placements | `useSignaturePlacement` | None (ephemeral) |
| Saved signatures | `useSignatures` hook | IndexedDB + Supabase |
| Document history | `History.tsx` | Supabase |
| Templates | `DocumentViewer.tsx` | IndexedDB |
| Sync queue | `syncQueue.ts` | localStorage |
| Theme | `next-themes` | localStorage |
| Biometric setting | `biometricLock.ts` | localStorage |

---

## Quick Start

```bash
git clone https://github.com/LucMuhizi/draw-sign-pro.git
cd draw-sign-pro
npm install
npm run dev
```

Open **http://localhost:8080**.

> The dev server binds to all interfaces (`host: "::"` in `vite.config.ts`), so other devices on the same WiFi can reach it at `http://<your-pc-ip>:8080`.

### Prerequisites

- **Node.js ≥ 18** — verified with `node -v`
- **npm** — bundled with Node

Only needed beyond Node:

| Goal | Additional requirement |
|---|---|
| Web dev | none |
| Web Docker build | Docker Desktop |
| Android emulator | Android Studio + JDK 21 + AVD |
| Android device (APK install) | USB cable + Developer Options + USB debugging |
| Android device (live reload) | USB cable + a second terminal for `npm run android:dev` |

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 8080, binds all interfaces |
| `npm run build` | Production build to `dist/` |
| `npm run build:dev` | Development-mode build (faster, unminified) |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | ESLint over the whole project |
| `npm run android:sync` | `npm run build` + `npx cap sync android` |
| `npm run android:run` | Build, sync, and launch on Android emulator / device |
| `npm run android:open` | Open the Capacitor Android project in Android Studio |
| `npm run android:dev` | Live-reload on a connected Android device |

---

## Environment Variables

Create a `.env` in the project root. Both variables are **optional** — without them the app runs in **local-only mode** and no data leaves the device.

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

| Variable | Required? | What it enables |
|---|---|---|
| `VITE_SUPABASE_URL` | No | Supabase auth + cloud sync |
| `VITE_SUPABASE_ANON_KEY` | No | Same |

`src/lib/supabase.ts` exports a **non-null proxy** — accessing Supabase methods when the env vars are missing returns graceful empty results instead of throwing.

---

## Project Structure

```
draw-sign-pro/
├── android/                          # Capacitor Android project (Java + Gradle)
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       ├── java/com/signdocu/app/MainActivity.java
│   │       ├── res/xml/shortcuts.xml
│   │       └── res/...                # icons, values, layouts
│   ├── build.gradle
│   └── gradle/
├── public/                            # Static assets (PWA manifest, icons)
├── screenshots/                       # Rendered step mockups with annotations
│   ├── README.md                      # Folder index
│   ├── 01-upload.svg
│   ├── 02-place.svg
│   ├── 03-sign.svg
│   └── 04-export.svg
├── docs/                              # Long-form documentation
│   ├── README.md                      # Docs folder index
│   ├── SPECS.md                       # Full feature spec
│   ├── screenshots.md                 # Visual tour walkthrough
│   └── design/
│       ├── p5-market-ready.md
│       └── premium-animations.md
├── src/
│   ├── App.tsx                        # Root: providers + init hooks
│   ├── main.tsx                       # React entry
│   ├── index.css                      # Tailwind + custom keyframes
│   ├── components/
│   │   ├── ActionBar.tsx              # Bottom nav + theme toggle
│   │   ├── BottomSheet.tsx            # vaul wrapper
│   │   ├── DocumentScanner.tsx        # Native scanner UI
│   │   ├── DocumentUpload.tsx         # Drag-drop + file picker + scan launcher
│   │   ├── DocumentViewer.tsx         # Doc view + field type toolbar
│   │   ├── ImageCropDialog.tsx        # Photo crop
│   │   ├── OfflineDemo.tsx            # First-run offline tutorial
│   │   ├── ParticleBackground.tsx     # CSS animated dots
│   │   ├── ProtectedRoute.tsx         # Auth guard
│   │   ├── QuickSignOverlay.tsx       # One-tap signature bottom sheet
│   │   ├── RecipientManager.tsx       # Multi-party recipient UI
│   │   ├── SettingsDialog.tsx         # Biometric + cache mgmt
│   │   ├── SignatureCreator.tsx       # Draw / type / photo / upload signature
│   │   ├── Skeleton.tsx               # Skeleton loaders
│   │   ├── StepIndicator.tsx          # 4-step indicator
│   │   ├── UserMenu.tsx               # Auth state dropdown
│   │   ├── animations/
│   │   │   ├── AIFieldDiscovery.tsx
│   │   │   ├── DocumentFoldIn.tsx
│   │   │   ├── InkedSignature.tsx
│   │   │   ├── MultiPartyProgress.tsx
│   │   │   ├── PressableButton.tsx
│   │   │   └── SuccessBurst.tsx
│   │   ├── document-viewer/
│   │   │   ├── DocumentRenderer.tsx        # PDF page + image rendering
│   │   │   ├── RecipientBadge.tsx
│   │   │   └── SignaturePlacementLayer.tsx
│   │   └── ui/                       # shadcn/ui primitives
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── usePullToRefresh.ts
│   │   └── useSignaturePlacement.ts
│   ├── lib/
│   │   ├── auditTrail.ts             # SHA-256 cert generation
│   │   ├── AuthContext.tsx           # Supabase auth provider
│   │   ├── backgroundRemoval.ts      # Signature binarization
│   │   ├── biometricLock.ts          # Fingerprint / face
│   │   ├── cameraScan.ts             # Capacitor Camera wrapper
│   │   ├── documentActions.ts        # Download / share signed docs
│   │   ├── documentHistory.ts        # Supabase document records
│   │   ├── documentScanner.ts        # Native scanner + enhance
│   │   ├── docxConverter.ts          # mammoth .docx → HTML
│   │   ├── haptics.ts                # 6-level haptics
│   │   ├── imageSigner.ts            # Canvas image + fields → PNG
│   │   ├── multiPartySigning.ts      # Multi-party core logic
│   │   ├── ocrFields.ts              # Smart field detection
│   │   ├── offlineMode.ts            # Cache API + IndexedDB
│   │   ├── pdfSigner.ts              # pdf-lib signature embed
│   │   ├── pushNotifications.ts      # Deferred push permission
│   │   ├── pwaInstall.ts             # Install prompt
│   │   ├── share.ts                  # Native share + fallback
│   │   ├── signatureStorage.ts       # IndexedDB + Supabase sync
│   │   ├── storage.ts                # Storage primitive (IndexedDB)
│   │   ├── supabase.ts               # Non-null Supabase client
│   │   ├── syncQueue.ts              # Exponential backoff queue
│   │   ├── templateStorage.ts        # Field layout templates
│   │   ├── userProfile.ts            # Quick-sign profile
│   │   └── utils.ts                  # formatDate + helpers
│   └── pages/
│       ├── History.tsx               # Signed document history
│       ├── Index.tsx                 # Main signing workflow
│       ├── Landing.tsx               # Marketing landing (unauthenticated)
│       ├── Login.tsx                 # Email login
│       ├── SignRecipient.tsx         # Multi-party recipient signing page
│       ├── SignUp.tsx                # Email sign-up
│       └── NotFound.tsx              # 404
├── supabase/
│   ├── functions/
│   │   └── send-notification/        # Edge function for push notifications
│   └── supabase-schema.sql           # Tables, RLS, storage buckets
├── capacitor.config.ts
├── Dockerfile                        # Nginx static serve
├── Dockerfile.android                # Gradle build in Docker
├── docker-compose.yml                # Web production
├── docker-compose.android.yml        # Android Docker build
├── nginx.conf
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Running the App

SignDocu runs identically on every platform below. Pick the path that matches your environment.

### Web (Dev Server)

```bash
npm install
npm run dev
# → http://localhost:8080
```

All features work in the browser. Some `@capacitor/*` plugins (camera, biometric, native share) fall back to web APIs that require HTTPS or `http://localhost`.

### Web (Docker)

```bash
docker-compose up -d
# → http://localhost:3000
```

Health check: `http://localhost:3000/health`. To change the host port, edit `docker-compose.yml` (e.g. `"8080:80"`) and the `nginx.conf` location rules accordingly.

### PWA over Local WiFi (zero install)

For a quick test on a real phone (no APK, no USB, no dev server on the phone):

1. On the PC, start the dev server:
   ```bash
   npm run dev
   # The Network URL printed in the terminal is what the phone will use.
   ```
   `vite.config.ts` binds to `::`, so the server listens on **all interfaces**.
2. On the phone, ensure it's on the **same WiFi subnet** as the PC.
3. Find the PC's IPv4 — PowerShell:
   ```powershell
   ipconfig | findstr IPv4
   ```
   Pick the non-virtual address (usually the `192.168.x.x` entry, not the `172.x` Docker / `192.168.137.x` ICS entries).
4. Open Chrome on the phone → `http://<pc-ipv4>:8080` → menu → **Add to Home Screen**.

PWA features:
- ✅ Full PDF / Word / image signing
- ✅ All 5 field types
- ✅ Offline mode, history, templates
- ✅ Web camera fallback (`getUserMedia`)
- ✅ Web Share API for sharing the signed file
- ⚠️ No native biometric (fallback: tap-to-unlock)

### Android (npm scripts — needs Android Studio + JDK)

```bash
# One-time
npm install
npm install -g @capacitor/cli   # optional

# Set env vars (Windows PowerShell)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.0.35-hotspot\"

# Start an emulator from Android Studio (Device Manager → Play)
# Then:
npm run android:run
```

This chains: `npm run build` → `npx cap sync android` → `npx cap run android`.

### Android Live Reload over USB

Run your code on a real phone with hot reload:

1. On the phone: enable Developer Options (tap **Build Number** 7 times) → enable **USB debugging**.
2. Plug into PC. Select **File transfer / MTP** (not "Charging only"). Approve the RSA fingerprint dialog.
3. On the PC:
   ```bash
   # Terminal 1
   npm run dev

   # Terminal 2
   npm run android:dev
   ```
   The Capacitor live-reload build installs a WebView shell on the phone that loads from your dev server, so any save in `*.tsx` / `*.ts` triggers a refresh on the device.

Verify: `adb devices` lists your phone before running `android:dev`.

### Android via Docker (no Android Studio needed)

If you don't want to install Android Studio + JDK:

```bash
docker-compose -f docker-compose.android.yml build
docker-compose -f docker-compose.android.yml run --rm android-builder
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`. The first build downloads ~1 GB of Gradle / SDK files; subsequent builds are incremental (~30 s).

### Install APK on a Physical Device

Three options — pick whichever works for you:

| Method | Steps |
|---|---|
| **ADB over USB** | `adb install android/app/build/outputs/apk/debug/app-debug.apk` then `adb shell am start -n com.signdocu.app/.MainActivity` |
| **USB transfer** | Copy `app-debug.apk` to the phone's storage, open the file in a file manager, allow "Install unknown apps" for that file manager, install |
| **Cloud / email** | Email the APK to yourself or upload to Drive, download on phone, install |

> The launcher icon is **SignDocu** (package `com.signdocu.app`).

---

## Supabase Setup

SignDocu works **fully without Supabase** — all features in local-only mode. Supabase adds:

- Email authentication
- Signature cloud sync across devices
- Signed document history backed by Postgres
- Multi-party signing sessions

### 1. Create a Supabase project

Visit [supabase.com](https://supabase.com) and create a new project.

### 2. Run the schema

Open Supabase Dashboard → **SQL Editor** → paste the contents of [`supabase-schema.sql`](./supabase-schema.sql) → **Run**.

This creates:

| Resource | Purpose |
|---|---|
| `signatures` table | User signatures (data URLs) — RLS-locked to `auth.uid() = user_id` |
| `documents` table | Signed document records |
| `signing_sessions` table | Multi-party session metadata with `share_token` |
| `signing_participants` table | Per-recipient state, color, assigned fields |
| `signed-documents` storage bucket | Private file storage with folder-per-user RLS |

### 3. Enable Email auth

Supabase Dashboard → **Authentication** → **Providers** → enable **Email**.

### 4. Set environment variables

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Restart the dev server after editing `.env`.

### 5. (Optional) Deploy the Edge Function

See [Push Notification Edge Function](#push-notification-edge-function).

---

## Push Notification Edge Function

Located in `supabase/functions/send-notification/`. Deploy with the Supabase CLI:

```bash
# One-time
npm install -g supabase
supabase login

# From the project root
supabase link --project-ref <your-project-id>
supabase functions deploy send-notification
supabase secrets set FCM_SERVER_KEY=...
```

Without this deployment, the app's push-notification code (`src/lib/pushNotifications.ts`) still works locally — it just won't deliver server-side notifications.

---

## Multi-Party Setup

Multi-party signing is enabled when **Supabase is configured** (the sessions and participants tables live there).

### Enable multi-party in a session

1. Upload a document → tap **Multi-Party** in the action bar
2. Add recipients (email + display name) via `RecipientManager`
3. Each recipient is color-coded; their assigned fields are tagged with `recipientId`
4. Tap **Share Link** to copy the share URL
5. Each recipient opens the URL on their device → sees only their fields → signs → status updates in real time
6. Final document is downloaded by the sender when **all** have signed

### Real-time updates

`src/hooks/useSigningSession.ts` listens via Supabase Realtime channels:

```ts
supabase
  .channel(`session:${sessionId}`)
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'signing_participants' },
      (payload) => updateRecipient(payload.new))
  .subscribe();
```

### Offline behavior

Recipients can sign offline. The signature is queued in `syncQueue` and the participation status updates when they're back online.

---

## Troubleshooting

### Dev server issues

| Symptom | Fix |
|---|---|
| `EADDRINUSE :::8080` | Port busy. Edit `server.port` in `vite.config.ts`, or: `npx kill-port 8080` |
| Can't connect from phone | Windows Firewall: allow Node.js inbound on Private profile. Or run: `New-NetFirewallRule -DisplayName "Node Vite Dev" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Profile Private -Action Allow` |
| HMR not working | Hard-refresh browser — Vite client may need re-registration |

### Android emulator issues

| Symptom | Fix |
|---|---|
| `adb: command not found` | Install Platform Tools: `winget install Google.PlatformTools` — no Android Studio needed |
| Emulator boot loop / black screen | Enable virtualization in BIOS (Intel VT-x / AMD-V) |
| Gradle: *"Could not find tools.jar"* | Java version mismatch — install JDK 21, set `JAVA_HOME` |
| `gradlew.bat assembleDebug` fails on Java 17 | Gradle 8.11 requires JDK 21. Run `java -version` to verify |
| Device shows "Installation failed" | Uninstall any previous build (`adb uninstall com.signdocu.app`) and retry |

### PowerShell on Windows

```powershell
# If you see "running scripts is disabled":
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# If npm scripts throw "spawn EINVAL":
git config --global core.symlinks false
```

### Docker Android build hangs

The first build downloads ~1 GB of Gradle / Android SDK packages. If it stalls:

1. `docker ps -a` — look for zombie containers
2. `docker system prune -f` — clean up dangling images
3. Retry `docker-compose -f docker-compose.android.yml build --no-cache` to force a fresh download

### Synchronization issues

If web edits don't appear on the device:

```bash
npm run build
npx cap sync android       # copies dist/ into android/app/src/main/assets/
```

Then either:

- Re-install the APK (`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`), or
- Hard-restart the live-reload session: stop `npm run android:dev` and re-run it

### TypeScript errors blocking commits

The project deliberately accepts some `any` typings and pre-existing lint warnings. To view all errors:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

To skip lint on commit (no hooks are configured by default):

```bash
git commit --no-verify -m "..."
```

---

## Performance Characteristics

| Metric | Value | Notes |
|---|---|---|
| Initial bundle (production, gzipped) | ~16 MB | Code-split per route |
| First paint (warm cache) | < 1 s | Vite + Service Worker |
| PDF render (single page) | < 200 ms | pdfjs canvas render |
| OCR fast path (text PDF) | < 100 ms / page | `getTextContent()` |
| OCR slow path (scanned PDF) | 2–8 s / page | Tesseract.js on-device |
| `.docx` → HTML conversion | < 500 ms | mammoth.js |
| PDF signing (10 placements) | < 1 s | pdf-lib |
| Image signing | < 500 ms | Canvas composition |
| Background removal | < 100 ms | Signature-sized image |
| Memory (idle) | ~40 MB | Chrome DevTools |
| Memory (signing + OCR active) | ~80 MB | — |

### Bundle optimization

- Removed: Three.js, recharts, cmdk, input-otp, canvas-confetti, camera-preview
- Lazy-loaded: Tesseract.js, mammoth.js, all Capacitor plugins via dynamic `import()`
- Tree-shaken: shadcn/ui (only used components imported)
- vite-plugin-pwa workbox: 30 MB max precache file size, ORT-WASM excluded

---

## Compliance & Legal Limitations

> **SignDocu signatures are NOT legally binding under eIDAS, ESIGN, or UETA.** The audit certificate explicitly states this.

| Use case | SignDocu OK? |
|---|:---:|
| Internal team approvals | ✅ |
| Personal forms and pre-fills | ✅ |
| Mockups / design reviews | ✅ |
| Documents where legal non-repudiation is required | ❌ |
| Employment contracts | ❌ |
| Real estate transactions | ❌ |
| Financial agreements | ❌ |
| Government forms requiring certified signatures | ❌ |

For legally binding signatures, use a qualified trust service provider (DocuSign, Adobe Sign, Dropbox Sign, etc.).

---

## Roadmap

For the complete feature roadmap including iOS, multi-signer improvements, and DocuSign API integration, see **[SPECS.md — Roadmap](./docs/SPECS.md#roadmap)**.

### Short-term

- Unit test suite (Vitest + React Testing Library)
- E2E tests (Playwright)
- Global error boundary
- Accessibility audit (ARIA, keyboard nav, screen reader)
- iOS build (Capacitor iOS config + App Store submission)

### Medium-term

- Multi-signer workflow v2 (sender → recipient email → shareable link)
- Email delivery via Supabase Edge Functions
- DocuSign API integration (optional legal compliance add-on)
- PDF form auto-population
- Cloud storage connectors (Google Drive, OneDrive, Dropbox)

### Long-term

- Blockchain audit trail (Merkle-proof on public chain)
- ML-based field detection (replace keyword matching)
- Team / org accounts with shared templates
- REST API + webhooks for embedding SignDocu in other apps
- White-label branding

---

## Documentation Map

| Doc | Covers |
|---|---|
| **README.md** (this file) | Overview, visual tour, feature catalog, run instructions |
| [`screenshots/`](./screenshots/) | Rendered SVG mockups of each flow step with annotations |
| [`docs/`](./docs/) | Long-form documentation (specs, tours, design rationale) |
| [`docs/SPECS.md`](./docs/SPECS.md) | Full data model, API surface, state management, competitive analysis |
| [`docs/screenshots.md`](./docs/screenshots.md) | Annotated walkthrough + implementation details for each screen |
| [`docs/design/p5-market-ready.md`](./docs/design/p5-market-ready.md) | Implemented pillar plans (Quick Sign, Native UX, Multi-Party, Offline marketing) |
| [`docs/design/premium-animations.md`](./docs/design/premium-animations.md) | Animation system design rationale |
| [`supabase-schema.sql`](./supabase-schema.sql) | Tables, RLS policies, storage buckets |

---

## License

Private / unreleased.

---

<p align="center">
  Built with React, Capacitor, and a lot of love for offline-first apps.<br/>
  Made by <a href="https://github.com/LucMuhizi">Luc Muhizi</a>.
</p>
