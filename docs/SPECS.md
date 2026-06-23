# SignDocu — Technical Specifications & Features

> Complete feature catalog, data model, API surface, and competitive analysis.
> Last updated: June 2026

---

## Table of Contents

1. [Application Overview](#application-overview)
2. [Feature Catalog](#feature-catalog)
3. [Data Model](#data-model)
4. [Component Architecture](#component-architecture)
5. [Library API Surface](#library-api-surface)
6. [State Management](#state-management)
7. [Offline Architecture](#offline-architecture)
8. [Security Model](#security-model)
9. [Performance Characteristics](#performance-characteristics)
10. [Competitive Analysis](#competitive-analysis)
11. [Compliance & Limitations](#compliance--limitations)
12. [Roadmap](#roadmap)

---

## Application Overview

| Property | Value |
|----------|-------|
| **Name** | SignDocu |
| **Type** | Progressive Web App + Capacitor Android native |
| **Language** | TypeScript 5.8 |
| **Framework** | React 18.3 |
| **Build tool** | Vite 5.4 |
| **Package manager** | npm |
| **Node target** | ≥18 |
| **Android API** | ≥24 (Android 7.0) |
| **Bundle size** | ~16MB (production, gzipped) |
| **License** | Private |

### Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Web (PWA)** | ✅ Full | All features via browser; some native APIs fallback |
| **Android** | ✅ Native | Capacitor wrapper with full native API access |
| **iOS** | ⚠️ Planned | Capacitor config ready; iOS build TBD |
| **Desktop** | ✅ Works | Via browser only; no Electron wrapper |

---

## Feature Catalog

### 1. Document Input

#### 1.1 Drag & Drop Upload
- **File**: `src/components/DocumentUpload.tsx`
- **Implementation**: HTML5 Drag and Drop API with React event handlers
- **Visual**: Animated drop zone with pulsing border and icon swap
- **States**: idle, dragging, file selected (checkmark animation)

#### 1.2 File Picker
- **Accepted formats**: `.pdf`, `.docx`, `.doc`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tiff`, `image/*`
- **Implementation**: Hidden `<input type="file">` triggered by Browse button
- **Validation**: MIME type + extension check with error toast

#### 1.3 Smart Scan
- **File**: `src/components/DocumentScanner.tsx`, `src/lib/documentScanner.ts`
- **Plugin**: `@southdevs/capacitor-document-scanner` v7.3
- **Capabilities**: Edge detection, perspective correction, auto-crop
- **Output**: Enhanced JPEG with contrast/brightness/saturation filter + grayscale thresholding
- **Availability**: Native Android only; hidden on web

#### 1.4 Quick Photo
- **File**: `src/lib/cameraScan.ts`
- **Plugin**: `@capacitor/camera` v7
- **Native path**: `Camera.getPhoto()` with quality 85, correctOrientation
- **Web fallback**: `<input capture="environment">` with FileReader
- **Post-processing**: `ImageCropDialog.tsx` for manual crop

### 2. Signature Creation

#### 2.1 Draw Mode
- **File**: `src/components/SignatureCreator.tsx`
- **Library**: `react-signature-canvas` v1.1
- **Canvas**: 100% width × 192px height, CSS `touch-action: none`
- **Output**: `canvas.toDataURL()` → PNG data URL
- **Controls**: Clear button, Save button

#### 2.2 Type Mode
- **File**: `src/components/SignatureCreator.tsx` (inline function `renderTypedSignature`)
- **Fonts**: Serif (`Georgia`), Script (`cursive`), Sans (`system-ui`), Mono (`monospace`)
- **Size**: 48px base, auto-scaled to canvas
- **Features**: Live preview, subtle underline accent, 20px padding
- **Output**: Canvas → `toDataURL("image/png")`

#### 2.3 Photo Mode
- **Plugin**: `@capacitor/camera` — `CameraSource.Camera`, quality 90, allowEditing
- **Pipeline**: Photo → `backgroundRemoval.ts` (canvas thresholding + contrast filter) → PNG
- **Fallback**: File input with `accept="image/*"`

#### 2.4 Upload Mode
- **File input** with `accept="image/*"`
- **Pipeline**: File → FileReader → `processImageWithBackgroundRemoval()` → PNG

#### 2.5 Signature Background Removal
- **File**: `src/lib/backgroundRemoval.ts`
- **Algorithm**: Canvas pixel iteration → grayscale conversion → threshold at 200 → set alpha to 0 for light pixels
- **Performance**: Runs synchronously on main thread (acceptable for signature-sized images)

### 3. Field Placement System

#### 3.1 Field Types

| Type | Default Size | Rendering (PDF) | Rendering (Image) |
|------|-------------|-----------------|-------------------|
| **Signature** | 150×60px | Embedded PNG/JPG image | Canvas `drawImage` |
| **Typed Name** | 200×50px | pdf-lib `drawText` (Helvetica) | Canvas `fillText` (serif) |
| **Date** | 140×40px | pdf-lib `drawText` + `formatDate()` | Canvas `fillText` (sans-serif) |
| **Initials** | 80×50px | pdf-lib `drawText` (HelveticaBold, uppercase) | Canvas `fillText` (bold serif) |
| **Checkbox** | 30×30px | pdf-lib `drawRectangle` + `drawText('✓')` | Canvas `strokeRect` + `fillText('✓')` |

#### 3.2 Date Formatting
- **File**: `src/lib/utils.ts` — `formatDate(format: string): string`
- **Supported tokens**: `MM` (month), `DD` (day), `YYYY` (full year), `YY` (2-digit year)
- **Examples**: `"MM/DD/YYYY"` → `"06/15/2026"`, `"DD/MM/YY"` → `"15/06/26"`

#### 3.3 Placement Interactions

| Interaction | Implementation | File |
|-------------|---------------|------|
| **Drag** | Pointer events + `setPointerCapture` + bounding rect clamp | `useSignaturePlacement.ts` |
| **Resize** | 8-point corner/edge handles + pointer delta math | `useSignaturePlacement.ts` |
| **Pinch-to-zoom** | TouchEvents `touches.length === 2` + distance ratio scaling | `useSignaturePlacement.ts` |
| **Remove** | Red × button on hover, haptic feedback | `SignaturePlacementLayer.tsx` |
| **Toggle checkbox** | Click handler → state toggle with haptic | `useSignaturePlacement.ts` |

#### 3.4 Templates
- **File**: `src/lib/templateStorage.ts`
- **Storage**: IndexedDB (via `storage.ts` wrapper) with prefix `signdocu-template`
- **Operations**: Save (name + placements), Load (→ `setSignatures()`), Delete, List
- **Data**: Strips runtime fields (id, checked); preserves x/y/w/h/page/fieldType/text

### 4. Document Viewing

#### 4.1 PDF Rendering
- **File**: `src/components/document-viewer/DocumentRenderer.tsx`
- **Library**: pdfjs-dist v5 — `getDocument()` + `page.render()`
- **Scale**: Responsive — container width − 32px padding, clamped to 280–800px
- **Pagination**: PageNavigation component with prev/next + page counter
- **Multi-page**: Renders one page at a time; `onDocumentLoadSuccess` callback sets page count

#### 4.2 Image Rendering
- **Detection**: `file.type.startsWith("image/")`
- **Rendering**: Native `<img>` element with `max-width: 100%` and `object-contain`
- **No pagination**: Single-page view; page controls hidden

#### 4.3 Word Document Rendering
- **File**: `src/lib/docxConverter.ts`
- **Library**: mammoth.js v1.12 — `convertToHtml()`
- **Pipeline**: File → `arrayBuffer` → mammoth convert → `wrapDocxHtml()` → div with `dangerouslySetInnerHTML`
- **Image handling**: Embedded images converted to base64 data URIs (no external requests)
- **Styling**: Inline CSS mimicking Word defaults (Calibri, 14px, 1.6 line-height)
- **Format support**: `.docx` (Office Open XML) + `.doc` (legacy binary, best-effort)
- **Warnings**: Logged to console for unsupported formatting

### 5. OCR Field Detection

#### 5.1 Smart Detection Strategy
- **File**: `src/lib/ocrFields.ts`
- **Decision**: Check page 1 text content — if ≥50 text items → text-based PDF → fast path; else → scanned PDF → OCR fallback

#### 5.2 Fast Path (Text PDFs)
- **Method**: `page.getTextContent()` → iterate items → keyword match
- **Keywords**: `signature`, `sign here`, `sign`, `x`, `authorized`, `approved`, `date`, `title`, `name`
- **Transform**: PDF coordinate space → screen coordinates via viewport transform matrix
- **Performance**: <100ms per page

#### 5.3 Slow Path (Scanned PDFs)
- **Method**: Render page to canvas at 2× scale → Tesseract.js `recognize()` → word-level bounding boxes → keyword match
- **Lazy loading**: `import('tesseract.js')` only triggered when needed
- **Worker lifecycle**: Created per page, terminated after extraction
- **Performance**: 2–8 seconds per page depending on device

#### 5.4 Detected Field Output
```typescript
interface DetectedField {
  page: number;
  x: number;      // Screen-space X
  y: number;      // Screen-space Y
  width: number;  // Padded to keyword text width + 60px
  height: number; // Based on font size + 30px padding
  label: string;  // Original detected text
}
```

### 6. Document Output

#### 6.1 PDF Signing (`pdf-lib`)
- **File**: `src/lib/pdfSigner.ts` — `embedSignaturesIntoPDF()`
- **Process**: Load PDF → for each placement → scale coordinates from screen to PDF space → draw field
- **Coordinate transform**: `screenValue * (pdfDimension / renderedDimension)`
- **Y-axis flip**: PDF origin is bottom-left; screen origin is top-left
- **Signature image**: Detected format (PNG/JPG) → embedded with `pdfDoc.embedPng/embedJpg`

#### 6.2 Image Signing (Canvas)
- **File**: `src/lib/imageSigner.ts` — `composeSignedImage()`
- **Process**: Load image → draw at natural resolution → compute scale factors → overlay fields → `canvas.toBlob("image/png")`

#### 6.3 Word Document Output
- **File**: `src/lib/documentActions.ts` — `renderDocxToPdfBlob()`
- **Process**: Capture rendered div as image via canvas → overlay field placements → create multi-page PDF via pdf-lib (splits tall content across pages)

#### 6.4 Audit Certificate
- **File**: `src/lib/auditTrail.ts`
- **Format**: A4 PDF (595.28×841.89 pts)
- **Contents**: Document name, SHA-256 hash, signature placement log with timestamps, legal disclaimer
- **Appending**: `appendCertificateToDocument()` — merges certificate as final page

#### 6.5 Sharing
- **File**: `src/lib/share.ts`, `src/lib/documentActions.ts`
- **Native**: Capacitor Share API (`Share.share()`) with title and dialog title
- **Web fallback**: Creates blob URL → programmatic `<a>` click → revokes URL
- **Edge Function**: Signed document URL generation via Supabase Storage (1-hour signed URLs)

### 7. Authentication & Authorization

#### 7.1 Supabase Auth
- **File**: `src/lib/AuthContext.tsx`
- **Methods**: Email/password sign-in, sign-up, sign-out, session persistence
- **Provider**: React Context with `useAuth()` hook
- **SSR-safe**: Checks `typeof window` before auth initialization
- **Route protection**: `ProtectedRoute.tsx` wraps authenticated pages; redirects to `/login`
- **Graceful degradation**: App works fully without Supabase configured; shows "Sign In" UI only when env vars are set

#### 7.2 Biometric Lock
- **File**: `src/lib/biometricLock.ts`
- **Plugin**: `@aparajita/capacitor-biometric-auth` v10
- **Capabilities**: Fingerprint + face recognition (device-dependent)
- **Flow**: Check availability → check if enabled in settings → `authenticate()` with reason string
- **Persistence**: `localStorage` boolean flag `draw-sign-pro-biometric-lock`
- **Fallback**: Device credential (PIN/pattern) via `allowDeviceCredential: true`

### 8. Offline & Sync

#### 8.1 Offline Mode
- **File**: `src/lib/offlineMode.ts`
- **Document caching**: Cache API (`caches.open('draw-sign-pro-docs')`) — Response objects with custom headers
- **Signature caching**: IndexedDB with prefix `draw-sign-pro-cached-sig`
- **Limit**: 5 cached documents (LRU eviction)
- **Detection**: `navigator.onLine` + `online`/`offline` event listeners
- **UI**: "Offline" badge in Index.tsx, online/offline indicator in Settings

#### 8.2 Background Sync Queue
- **File**: `src/lib/syncQueue.ts`
- **Storage**: `localStorage` JSON array, max 50 items
- **Scheduling**: Recursive `setTimeout` with exponential backoff
- **Delay curve**: 1s → 2s → 4s → 8s → 16s → 32s → 1m → 2m → 5m (cap)
- **Reset**: Delay resets to 1s on successful sync or reconnect
- **Retry limit**: 5 retries per action → auto-removed
- **Trigger**: On app start (immediate), on reconnect (window `online` event), on schedule

#### 8.3 Cloud Sync (Supabase)
- **File**: `src/lib/signatureStorage.ts`
- **Upload**: `syncLocalToCloud()` — compares local vs cloud by data_url, inserts new
- **Download**: `fetchCloudSignatures()` — fetches all user signatures, converts to local format
- **Trigger**: On app load when user is authenticated (Index.tsx `useEffect`)

### 9. Push Notifications
- **File**: `src/lib/pushNotifications.ts`
- **Plugin**: `@capacitor/push-notifications` v7
- **Permission strategy**: **Deferred** — not requested at startup. Requested after first successful document download.
- **Listeners**: `pushNotificationReceived` (foreground haptic), `pushNotificationActionPerformed` (app open), `registration` (token refresh)
- **Payload**: Supports `documentId` in notification data for deep linking

### 10. Mobile-Native Features

| Feature | Plugin | File |
|---------|--------|------|
| **Haptic feedback** (6 levels) | `@capacitor/haptics` v7 | `src/lib/haptics.ts` |
| **Splash screen** | `@capacitor/splash-screen` v7 | `src/App.tsx` → `MobileInit` |
| **Status bar** | `@capacitor/status-bar` v7 | `src/App.tsx` → `MobileInit` |
| **Keyboard handling** | `@capacitor/keyboard` v7 | `src/App.tsx` → `MobileInit` |
| **Camera** | `@capacitor/camera` v7 | `src/lib/cameraScan.ts` |
| **Document scanner** | `@southdevs/capacitor-document-scanner` v7 | `src/lib/documentScanner.ts` |
| **Share** | `@capacitor/share` v7 | `src/lib/share.ts` |
| **Android shortcuts** | XML config | `android/app/src/main/res/xml/shortcuts.xml` |

#### 10.1 Android App Shortcuts
- **Sign New**: Launches app → upload screen
- **Open Last**: Opens last signed document
- **Camera Scan**: Launches directly into camera scan

### 11. UX & Design

#### 11.1 Theming
- **Library**: `next-themes` v0.3
- **Modes**: Light (default), Dark, System preference
- **Implementation**: CSS class on `<html>` + Tailwind `dark:` variants
- **Persistence**: `localStorage` + system preference detection

#### 11.2 Animations
- **Library**: Framer Motion v12
- **Page transitions**: Directional slide (left/right) based on navigation direction
- **Micro-interactions**: Hover scale (1.02–1.08), tap scale (0.92–0.98), spring physics
- **List staggering**: `staggerChildren: 0.08` with `delayChildren: 0.1`
- **Gesture navigation**: Swipe between workflow steps with drag elasticity 0.15

#### 11.3 Particle Background
- **File**: `src/components/ParticleBackground.tsx`
- **Implementation**: Pure CSS — 20 absolutely positioned divs with `@keyframes float`
- **Randomization**: `useMemo`-frozen random positions, sizes (4–12px), durations (6–20s), delays
- **Performance**: Zero JavaScript overhead after initial render

#### 11.4 Workflow Steps
- **Steps**: Upload → Sign → Fields → Done
- **Navigation**: Bottom ActionBar + swipe gestures + "Continue" buttons
- **Step validation**: Can't skip ahead without completing prerequisites

#### 11.5 Swipe-to-Delete (History)
- **File**: `src/pages/History.tsx`
- **Gesture**: Framer Motion `drag="x"` with left constraint −120px
- **Threshold**: −120px triggers delete with haptic heavy feedback
- **Confirm**: Long-press (500ms) shows confirmation dialog

---

## Data Model

### SignaturePlacement (Core)
```typescript
interface SignaturePlacement {
  id: string;           // Unique: `sig-{timestamp}-{random}`
  x: number;            // Screen-space X (0–containerWidth)
  y: number;            // Screen-space Y (0–containerHeight)
  width: number;        // Displayed width
  height: number;       // Displayed height
  page: number;         // PDF page number (1-based)
  fieldType?: FieldType; // 'signature' | 'typed' | 'date' | 'initials' | 'checkbox'
  typedText?: string;   // Text content for typed/initials
  fontFamily?: string;  // Font for typed fields
  dateFormat?: string;  // e.g. "MM/DD/YYYY"
  checked?: boolean;    // Checkbox state
}

type FieldType = 'signature' | 'typed' | 'date' | 'initials' | 'checkbox';
```

### SavedSignature (Local + Cloud)
```typescript
interface SavedSignature {
  id: string;        // `{timestamp base36}{random 6 chars}`
  label: string;     // User-provided name
  dataUrl: string;   // PNG data URL
  createdAt: number; // Unix ms timestamp
}
```

### DocumentTemplate (IndexedDB)
```typescript
interface DocumentTemplate {
  id: string;              // `tpl-{timestamp}-{random}`
  name: string;            // User-provided template name
  documentName: string;    // Original file name
  pageCount: number;
  placements: Array<{      // Stripped SignaturePlacement
    x: number; y: number; width: number; height: number; page: number;
    fieldType: FieldType;
    typedText?: string;
    dateFormat?: string;
  }>;
  createdAt: number;
}
```

### SyncAction (Queue)
```typescript
interface SyncAction {
  id: string;                    // `{timestamp}-{random}`
  type: 'saveDocument' | 'uploadStorage' | 'syncSignature' | 'createRecord';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;               // 0–4, auto-removed at 5
}
```

### DetectedField (OCR)
```typescript
interface DetectedField {
  page: number;
  x: number; y: number; width: number; height: number;
  label: string;  // Detected keyword text
}
```

### AuditRecord (Certificate)
```typescript
interface AuditRecord {
  documentName: string;
  documentHash: string;   // SHA-256 hex
  signatures: Array<{
    id: string; page: number;
    x: number; y: number; width: number; height: number;
    placedAt: number;
  }>;
  signedAt: number;
}
```

### Supabase Schema

#### `signatures` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users(id)`, ON DELETE CASCADE, NOT NULL |
| `label` | `text` | NOT NULL, DEFAULT `''` |
| `data_url` | `text` | NOT NULL |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

RLS: Users can SELECT/INSERT/DELETE only their own rows.

#### `documents` table
| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users(id)`, ON DELETE CASCADE, NOT NULL |
| `original_filename` | `text` | NOT NULL |
| `storage_path` | `text` | Nullable |
| `page_count` | `integer` | DEFAULT 0 |
| `signature_count` | `integer` | DEFAULT 0 |
| `signed_at` | `timestamptz` | NOT NULL, DEFAULT `now()` |

#### `signed-documents` storage bucket
- **Public**: false (private)
- **RLS**: Authenticated users can SELECT/INSERT only in their user ID folder

---

## Component Architecture

### Component Tree
```
<App>
├── <QueryClientProvider>
│   └── <ThemeProvider>
│       └── <AuthProvider>
│           └── <TooltipProvider>
│               ├── <Toaster />           (shadcn toast)
│               ├── <Sonner />            (sonner toast)
│               ├── <MobileInit />        (Capacitor init, push listeners)
│               ├── <AppInit />           (background sync)
│               ├── <ParticleBackground /> (CSS animated dots)
│               └── <BrowserRouter>
│                   ├── "/" → <ProtectedRoute> → <Index />
│                   │   ├── <ActionBar>           (bottom nav + settings)
│                   │   ├── <DocumentUpload>       (drag-drop + scan)
│                   │   ├── <SignatureCreator>     (4 creation methods)
│                   │   └── <DocumentViewer>       (view + place + download)
│                   │       ├── <DocumentRenderer>          (PDF pages / image)
│                   │       ├── <SignaturePlacementLayer>   (field overlays)
│                   │       └── <SignaturePicker>           (saved sig thumbnails)
│                   ├── "/history" → <ProtectedRoute> → <History />
│                   │   └── <SwipeableCard> (swipe-to-delete)
│                   ├── "/login" → <Login />
│                   ├── "/signup" → <SignUp />
│                   └── "*" → <NotFound />
```

### Key Hook: `useSignaturePlacement`
```
useSignaturePlacement({ signature, currentPage, onSignaturePlaced })
  → {
      signatures,          // SignaturePlacement[]
      setSignatures,       // For template loading
      addSignature,        // Default signature at (100,100)
      addField,            // type + text + format → field at (100,100)
      addSignatureAtPosition, // At specific coordinates
      removeSignature,     // By ID
      toggleCheckbox,      // Toggle checked state
      handlePointerDown,   // Drag start / new placement
      handlePointerMove,   // Drag update / resize update
      handlePointerUp,     // Drag/resize end
      handleResizeStart,   // Resize handle grab
      handleTouchStart,    // Pinch start (2-finger)
      handleTouchMove,     // Pinch scale update
      handleTouchEnd,      // Pinch end
    }
```

---

## Library API Surface

### `pdfSigner.ts`
```typescript
embedSignaturesIntoPDF(
  pdfBytes: ArrayBuffer,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
  renderedPageWidth: number,
): Promise<Uint8Array>
```

### `imageSigner.ts`
```typescript
composeSignedImage(
  imageFile: File,
  signatureDataUrl: string,
  placements: SignaturePlacement[],
  displayedWidth: number,
  displayedHeight: number,
): Promise<Blob>
```

### `ocrFields.ts`
```typescript
detectSignatureFields(
  file: File,
  renderedPageWidth: number,
  numPages?: number,
): Promise<DetectedField[]>
```

### `docxConverter.ts`
```typescript
isDocxFile(file: File): boolean
convertDocxToHtml(file: File): Promise<DocxConvertResult>
wrapDocxHtml(html: string, fileName: string): string
```

### `documentActions.ts`
```typescript
downloadSignedDocument(opts: {
  file: File; fileUrl: string; isImage: boolean; isDocx: boolean;
  signature: string; signatures: SignaturePlacement[];
  pageWidth: number; numPages: number;
  containerElement: HTMLDivElement;
}): Promise<void>

shareSignedDocument(fileUrl: string, file: File): Promise<void>
```

### `auditTrail.ts`
```typescript
hashDocument(file: File): Promise<string>  // SHA-256
generateCertificate(record: AuditRecord): Promise<Uint8Array>
appendCertificateToDocument(pdfBytes: Uint8Array, certificateBytes: Uint8Array): Promise<Uint8Array>
```

### `syncQueue.ts`
```typescript
enqueueAction(type: SyncAction['type'], payload: Record<string, unknown>): void
startBackgroundSync(processor: (action: SyncAction) => Promise<boolean>): void
stopBackgroundSync(): void
getQueueLength(): number
```

### `templateStorage.ts`
```typescript
getTemplates(): Promise<DocumentTemplate[]>
saveTemplate(name: string, documentName: string, pageCount: number, placements: SignaturePlacement[]): Promise<DocumentTemplate>
deleteTemplate(id: string): Promise<void>
templateToPlacements(template: DocumentTemplate): SignaturePlacement[]
```

### `biometricLock.ts`
```typescript
isLockEnabled(): boolean
setLockEnabled(enabled: boolean): void
isBiometricAvailable(): Promise<boolean>
authenticateWithBiometrics(reason?: string): Promise<boolean>
checkBiometricLock(): Promise<boolean>
```

### `offlineMode.ts`
```typescript
isOnline(): boolean
onOnlineChange(callback: (online: boolean) => void): () => void
cacheDocument(file: File): Promise<void>
getCachedDocument(docId: string): Promise<{ file: File; name: string } | null>
getCachedDocuments(): CachedDocument[]
cacheSignatures(signatures: Signature[]): Promise<void>
getCachedSignatures(): Promise<Signature[]>
clearOfflineCache(): Promise<void>
getCacheInfo(): Promise<{ docs: number; sigs: number }>
```

### `haptics.ts`
```typescript
hapticLight(): Promise<void>
hapticMedium(): Promise<void>
hapticHeavy(): Promise<void>
hapticSuccess(): Promise<void>
hapticError(): Promise<void>
hapticWarning(): Promise<void>
```

---

## State Management

SignDocu uses a **distributed state model** — no centralized store:

| State | Location | Persistence |
|-------|----------|-------------|
| Auth session | `AuthContext` (React Context) | Supabase session in `localStorage` |
| Active signature | `Index.tsx` `useState` | None (ephemeral) |
| Selected file | `Index.tsx` `useState` | Cache API (offline) |
| Signature placements | `useSignaturePlacement` hook state | None (ephemeral) |
| Saved signatures | `useSignatures` hook | IndexedDB + Supabase |
| Document history | `History.tsx` `useState` | Supabase |
| Templates | `DocumentViewer.tsx` `useState` | IndexedDB |
| Sync queue | `syncQueue.ts` module state | `localStorage` |
| Biometric setting | `biometricLock.ts` | `localStorage` |
| Theme | `next-themes` | `localStorage` |
| Offline cache | `offlineMode.ts` | Cache API + IndexedDB |
| Server state | `@tanstack/react-query` | In-memory cache |

---

## Offline Architecture

```
                    ┌──────────────────────┐
                    │   User Action         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Is navigator.onLine? │
                    └──────┬──────┬────────┘
                           │ Yes  │ No
                    ┌──────▼──┐ ┌─▼──────────┐
                    │ Process │ │ Cache to    │
                    │ directly│ │ IndexedDB/  │
                    └────┬────┘ │ Cache API   │
                         │      └─────┬───────┘
                         │            │
                    ┌────▼────────────▼──────┐
                    │   Save to sync queue    │
                    │   (localStorage JSON)   │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  Exponential backoff    │
                    │  setTimeout schedule    │
                    │  1s → 2s → 4s... → 5min │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │  Process queue items    │
                    │  (Supabase uploads)     │
                    │  Success → dequeue      │
                    │  Failure → retry++      │
                    │  5 retries → discard    │
                    └────────────────────────┘
```

### Storage Technologies

| Technology | Used For | Capacity |
|-----------|----------|----------|
| **Cache API** | Document files (blobs) | Browser-managed, typically ~100MB+ |
| **IndexedDB** | Signatures, templates | Browser-managed, typically ~50MB+ |
| **localStorage** | Sync queue, settings, flags | 5–10MB per origin |
| **Supabase** | Cloud sync (optional) | Project plan limits |
| **Supabase Storage** | Signed PDFs (optional) | Project plan limits |

---

## Security Model

### Document Security
- **At rest**: Documents in Cache API (browser sandboxed), signed PDFs optionally in Supabase Storage (RLS-protected)
- **In transit**: Supabase connections use TLS 1.3
- **Local**: No encryption of locally cached files (relies on device-level encryption)

### Authentication
- **Supabase Auth**: Email/password with bcrypt-hashed passwords
- **Biometric**: Device-native fingerprint/face via Android BiometricPrompt / iOS FaceID
- **Session**: JWT-based, auto-refreshed by Supabase client

### Audit Trail
- **Document hash**: SHA-256 of original file's ArrayBuffer
- **Certificate**: Generated PDF with hash + placement log + timestamps
- **Disclaimer**: Explicitly states signatures are NOT eIDAS/ESIGN/UETA compliant

### Known Limitations
- No end-to-end encryption of document content
- Audit certificate is self-generated (not third-party verified)
- No digital signature (PKI/x.509) — only visual signature embedding
- Biometric lock is app-level, not file-level encryption

---

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| **Initial bundle** | ~16MB | Production build, gzipped |
| **First paint** | <1s | Dev server, warm cache |
| **PDF render (1 page)** | <200ms | pdfjs canvas render |
| **OCR (text PDF)** | <100ms/page | Text extraction path |
| **OCR (scanned PDF)** | 2–8s/page | Tesseract.js, device-dependent |
| **Docx conversion** | <500ms | mammoth.js, client-side |
| **PDF signing** | <1s | pdf-lib, 10 placements |
| **Image signing** | <500ms | Canvas composition |
| **Background removal** | <100ms | Signature-sized image |
| **Sync check** | <50ms | localhost, empty queue |
| **Memory (idle)** | ~40MB | Chrome DevTools |
| **Memory (signing)** | ~80MB | PDF + OCR active |

### Bundle Optimization (Post-P2 Cleanup)
- Removed: Three.js (~500KB), recharts, cmdk, input-otp, canvas-confetti, camera-preview
- Lazy-loaded: Tesseract.js, mammoth.js, all Capacitor plugins
- Tree-shaken: shadcn/ui (only used components imported)

---

## Competitive Analysis

### Feature Comparison Matrix

| Feature | SignDocu | DocuSign | Adobe Sign | Dropbox Sign | PandaDoc | SignNow | SignEasy |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Price (individual)** | Free | $10-15/mo | $13/mo | $15/mo | $19-35/mo | $8/mo | $10/mo |
| **Offline signing** | ✅ Full | ⚠️ Limited | ⚠️ Limited | ❌ | ❌ | ❌ | ❌ |
| **Draw signature** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Type signature** | ✅ 4 fonts | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Photo signature** | ✅ + bg removal | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **PDF support** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Word (.docx) support** | ✅ Native | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **OCR field detection** | ✅ Smart | ✅ AI | ✅ AI | ❌ | ❌ | ❌ | ❌ |
| **Typed name field** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Date field** | ✅ Auto | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Initials field** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Checkbox field** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Templates** | ✅ Custom | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Biometric lock** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Audit certificate** | ✅ + disclaimer | ✅ Legal | ✅ Legal | ✅ Legal | ✅ Legal | ✅ Legal | ✅ Legal |
| **Multi-signer** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **API** | ❌ | ✅ REST | ✅ REST | ✅ REST | ✅ REST | ✅ REST | ❌ |
| **Cloud storage** | Optional (Supabase) | ✅ | ✅ Adobe Cloud | ✅ Dropbox | ✅ | ✅ | ❌ |
| **Legally binding** | ❌ | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS | ✅ eIDAS |
| **Self-hosted** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open source** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dark mode** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

### Unique Advantages
1. **Only app with native .docx → signed PDF pipeline** (no competitor handles Word files)
2. **Only app with full offline capability** (competitors require connectivity for all actions)
3. **Only app with biometric app-lock** (competitors have no device-level security for the app itself)
4. **Smallest bundle** (16MB vs 60–120MB for competitors)
5. **Zero cost** with no feature gating or document limits

### Key Gaps vs. Market Leaders
1. **Legal compliance** — No eIDAS/ESIGN/UETA certification (requires trusted third-party integration)
2. **Multi-signer workflows** — No sender→recipient→signer flow
3. **API access** — No programmatic integration for embedding in other apps
4. **Third-party integrations** — No Google Drive, OneDrive, Dropbox, Salesforce connectors
5. **Brand trust** — New entrant vs. established providers with decades of compliance history

---

## Compliance & Limitations

### What SignDocu Is
- A **visual signature placement tool** for documents
- Suitable for internal approvals, personal documents, mockups, and non-legal use
- A local-first tool that never requires your documents to leave your device

### What SignDocu Is NOT
- A **qualified electronic signature** (QES) provider under eIDAS
- A **digital signature** provider (no PKI/x.509 certificates)
- Compliant with **ESIGN Act** or **UETA** for legally binding electronic signatures
- A replacement for DocuSign, Adobe Sign, or other qualified trust service providers

### When to Use SignDocu
✅ Internal team approvals
✅ Personal documents and forms
✅ Mockups and design reviews
✅ Pre-filling forms before printing
✅ Signing documents where legal compliance is not required

### When to Use a Qualified Provider
❌ Employment contracts
❌ Real estate transactions
❌ Financial agreements
❌ Legal documents requiring non-repudiation
❌ Government forms requiring certified signatures

---

## Roadmap

### Short-term (Next 3 months)
- [ ] **Unit test suite** — Vitest + React Testing Library for all lib modules
- [ ] **E2E tests** — Playwright for critical user flows
- [ ] **Error boundary** — Global React error boundary with recovery UI
- [ ] **Accessibility audit** — ARIA labels, keyboard navigation, screen reader testing
- [ ] **iOS build** — Capacitor iOS configuration and App Store submission

### Medium-term (3–6 months)
- [ ] **Multi-signer workflow** — Sender → recipient flow with shareable links
- [ ] **Email delivery** — Supabase Edge Functions for sending signed documents
- [ ] **DocuSign API integration** — Optional legal compliance add-on
- [ ] **PDF form filling** — Auto-populate PDF form fields before signing
- [ ] **Cloud storage connectors** — Google Drive, OneDrive, Dropbox import/export

### Long-term (6–12 months)
- [ ] **Blockchain audit trail** — Merkle-proof document verification on public blockchain
- [ ] **AI-powered field detection** — Replace keyword matching with ML model
- [ ] **Team/org accounts** — Multi-user workspaces with shared templates
- [ ] **API & webhooks** — REST API for embedding SignDocu in other applications
- [ ] **White-label** — Customizable branding for enterprise deployments
