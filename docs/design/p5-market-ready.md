# P5 — Market-Ready Signing Experience

> **Four pillars:** One-tap signing, multi-party signing, native mobile UX, offline-first marketing
> Target: Transform SignDocu from a functional tool into a polished, competitive product

---

## Pillar 1: One-Tap Signing Workflow

### Current State
4-step wizard: Upload → Sign → Fields → Done. Each step requires manual navigation and button clicks. Signature creation takes 3-5 taps to reach a usable signature.

### Target State
Upload a document → signature auto-generated from profile name → auto-placed at default position → one "Sign & Download" tap.

### Architecture

```
┌──────────────────────────────────────────────────┐
│              One-Tap Flow                         │
├──────────────────────────────────────────────────┤
│                                                    │
│  User uploads document                             │
│         │                                          │
│         ▼                                          │
│  ┌─────────────────────────┐                      │
│  │ QuickSignOverlay        │  (new component)      │
│  │ ┌─────────────────────┐ │                      │
│  │ │ 📄 Contract.pdf     │ │                      │
│  │ │ ✍️ John Doe (auto)  │ │  ← typed sig preview  │
│  │ │ 📍 Top-right (auto) │ │  ← default position   │
│  │ │ [Change] [Sign Now] │ │                      │
│  │ └─────────────────────┘ │                      │
│  └─────────────────────────┘                      │
│         │                                          │
│         ▼                                          │
│  DocumentViewer opens with sig pre-placed          │
│  User can adjust position, then tap Download       │
│                                                    │
└──────────────────────────────────────────────────┘
```

### New/Changed Files

| File | Change |
|------|--------|
| **`src/lib/userProfile.ts`** (new) | Store user's name + preferred font + preferred signature position. IndexedDB-persisted. |
| **`src/components/QuickSignOverlay.tsx`** (new) | Post-upload bottom sheet showing auto-generated signature preview, position preview, Change + Sign Now buttons |
| **`src/components/SignatureCreator.tsx`** | Add `quickMode` prop — when true, skips method selection and goes straight to typed preview with profile name |
| **`src/pages/Index.tsx`** | Add `quickSign` state flag. When true: upload → skip SignatureCreator → skip "Continue" buttons → jump to DocumentViewer with pre-placed sig |
| **`src/hooks/useSignaturePlacement.ts`** | Add `autoPlaceDefault(signature: string)` — places signature at user's preferred position (default: top-right, 40px margin) |
| **`src/components/ActionBar.tsx`** | Add "Quick Sign" toggle button that enables one-tap mode |
| **`src/lib/signatureStorage.ts`** | Extend `SavedSignature` with `isDefault: boolean` — last-used or explicitly pinned |

### Data Flow

```
User uploads file
  → QuickSignOverlay checks isQuickSignEnabled
  → userProfile.getProfile() → name + preferredFont + preferredPosition
  → renderTypedSignature(name, preferredFont) → PNG dataURL
  → setSignature(dataURL)
  → setActiveAction("add-signature")
  → DocumentViewer mounts with signature ready
  → useSignaturePlacement.autoPlaceDefault(signature)
  → User sees sig placed, can adjust or tap Download
```

### User Profile Schema

```typescript
interface UserProfile {
  displayName: string;       // "John Doe"
  preferredFont: string;     // "cursive" | "serif" | "sans-serif" | "monospace"
  preferredSigColor: string; // "#1a1a1a"
  preferredPosition: {       // Where to auto-place first signature
    x: number;               // Default: right-aligned, 40px from top
    y: number;
    width: number;           // Default: 200
    height: number;          // Default: 60
  };
  quickSignEnabled: boolean; // One-tap mode toggle
  lastUsedSigId?: string;    // Last used saved signature ID
}
```

### UI States

| State | UI |
|-------|-----|
| **First visit** | No profile → Quick Sign shows "Set up your signature" prompt → opens profile form |
| **Profile set** | Upload → QuickSignOverlay slides up → shows "John Doe" preview → [Sign Now] |
| **Want to change** | Tap [Change] → SignatureCreator opens in quick mode (typed only, no method picker) |
| **Normal mode** | Quick Sign toggle off → existing 4-step wizard unchanged |

---

## Pillar 2: Multi-Party Signing (Parallel)

### Current State
Single user signs their own documents. No sharing, no recipient flow, no signing status tracking.

### Target State
User uploads a document, places signature fields for themselves AND named recipients. Recipients receive a shareable link. All parties sign independently. Document is final when all have signed.

### Architecture

```
┌──────────────────────────────────────────────────┐
│           Multi-Party Architecture                 │
├──────────────────────────────────────────────────┤
│                                                    │
│  SENDER FLOW                                       │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐ │
│  │ Upload   │ →  │ Place    │ →  │ Recipient     │ │
│  │ document │    │ fields   │    │ Manager       │ │
│  └──────────┘    └──────────┘    └──────┬───────┘ │
│                                         │          │
│  ┌──────────────────────────────────────▼───────┐ │
│  │ RecipientManager (new component)              │ │
│  │ ┌──────────────────────────────────────────┐ │ │
│  │ │ Recipients:                               │ │ │
│  │ │ • Me (sender)            [sig fields: 2]  │ │ │
│  │ │ • alice@email.com        [sig fields: 1]  │ │ │
│  │ │ • bob@email.com          [sig fields: 3]  │ │ │
│  │ │ [+ Add Recipient]                         │ │ │
│  │ │                                           │ │ │
│  │ │ [Share Link] [Send Emails]                │ │ │
│  │ └──────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  RECIPIENT FLOW                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Opens link → Sees document →                    │ │
│  │ Only sees THEIR fields (other fields grayed)   │ │
│  │ Signs → Submit → Status updates in Supabase    │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  SUPABASE BACKEND                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │ signing_sessions table:                       │ │
│  │   id, document_id, status, created_by         │ │
│  │                                              │ │
│  │ signing_participants table:                   │ │
│  │   id, session_id, email, status, fields JSON  │ │
│  │                                              │ │
│  │ Real-time: all participants see status live   │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└──────────────────────────────────────────────────┘
```

### New/Changed Files

| File | Change |
|------|--------|
| **`supabase-schema.sql`** | Add `signing_sessions` + `signing_participants` tables with RLS |
| **`supabase/functions/send-invitation/index.ts`** (new) | Edge Function: sends email invitation to recipient with signing link |
| **`src/lib/multiPartySigning.ts`** (new) | Core logic: createSession, addParticipant, getSession, updateParticipantStatus, checkAllSigned, generateFinalDocument |
| **`src/components/RecipientManager.tsx`** (new) | UI: add/remove recipients, assign fields to recipients, share link, send emails |
| **`src/components/document-viewer/RecipientBadge.tsx`** (new) | Shows which recipient a field belongs to (color-coded) |
| **`src/hooks/useSigningSession.ts`** (new) | Hook: subscribe to Supabase real-time updates for session status |
| **`src/pages/SignRecipient.tsx`** (new) | Recipient view: document + their fields only + submit button |
| **`src/App.tsx`** | Add route: `/sign/:sessionId` → SignRecipient |
| **`src/hooks/useSignaturePlacement.ts`** | Add `recipientId` to `SignaturePlacement` for field ownership |
| **`src/lib/pdfSigner.ts`** | Extend `SignaturePlacement` with `recipientId?: string` |
| **`src/components/DocumentViewer.tsx`** | When `recipientId` is set, show only that recipient's fields; others dimmed/locked |
| **`src/components/document-viewer/SignaturePlacementLayer.tsx`** | Dim/hide fields owned by other recipients; show recipient badge |
| **`src/pages/Index.tsx`** | Add multi-party vs single-party mode toggle |

### Supabase Schema Additions

```sql
-- Signing sessions
CREATE TABLE signing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_name TEXT NOT NULL,
  document_storage_path TEXT,           -- Signed PDF in Supabase Storage
  document_hash TEXT NOT NULL,          -- SHA-256 of original
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','expired')),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  share_token TEXT UNIQUE NOT NULL      -- For access without auth
);

-- Participants
CREATE TABLE signing_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES signing_sessions(id) ON DELETE CASCADE,
  email TEXT,
  user_id UUID REFERENCES auth.users(id),  -- NULL for non-registered recipients
  role TEXT DEFAULT 'signer' CHECK (role IN ('sender','signer','viewer')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','viewed','signed','declined')),
  fields JSONB NOT NULL DEFAULT '[]',      -- Their assigned SignaturePlacement[]
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: session creator can read/write; participants can read their own
-- share_token allows unauthenticated access to specific sessions
```

### Sharing URLs

```
https://signdocu.app/sign/{shareToken}
```

Recipient opens URL → Supabase validates token → loads session → shows document with only their fields → they sign → status updates in real-time.

### Signing States

| State | Sender sees | Recipient sees |
|-------|-------------|----------------|
| **Pending** | "Waiting for Alice, Bob" | "You've been invited to sign" |
| **Viewed** | "Alice opened the document" | Fields appear, ready to sign |
| **Signed** | "✅ Alice signed" | "✅ You signed. Waiting for others..." |
| **All signed** | "🎉 All parties signed! [Download]" | "✅ All signatures complete" |
| **Declined** | "❌ Alice declined" | N/A |

### Offline Behavior
- Sender can prepare session offline; queues in `syncQueue` for when online
- Recipients can sign offline; signature stored locally, synced on reconnect
- Status updates propagate via sync queue if real-time fails

---

## Pillar 3: Native Mobile UX

### Current State
Good foundation: Framer Motion page transitions, haptic feedback, gesture navigation, dark mode. But still feels web-like — no bottom sheets, no pull-to-refresh, no native navigation patterns.

### Target State
Feels indistinguishable from a native Android/iOS app. Bottom sheets for actions, swipe-back navigation, pull-to-refresh, skeleton loading everywhere, native-style transitions.

### Architecture

```
┌──────────────────────────────────────────────────┐
│           Native UX Improvements                   │
├──────────────────────────────────────────────────┤
│                                                    │
│  1. BOTTOM SHEETS (replace dialogs/modals)         │
│  ┌──────────────────────────────────────────────┐ │
│  │ • QuickSignOverlay → BottomSheet              │ │
│  │ • SettingsDialog → SettingsBottomSheet         │ │
│  │ • SignatureCreator method picker → BottomSheet │ │
│  │ • RecipientManager → BottomSheet               │ │
│  │ • ImageCropDialog → BottomSheet                │ │
│  │                                                │ │
│  │ Implementation: vaul (already installed!)      │ │
│  │ OR custom Framer Motion sheet with drag handle  │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  2. NATIVE NAVIGATION                              │
│  ┌──────────────────────────────────────────────┐ │
│  │ • Swipe-back gesture on all screens            │ │
│  │ • Stack-based navigation with shared elements  │ │
│  │ • Tab bar with native-style active indicator   │ │
│  │ • Pull-to-refresh on History page              │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  3. LOADING & FEEDBACK                             │
│  ┌──────────────────────────────────────────────┐ │
│  │ • Skeleton loaders on ALL async operations     │ │
│  │ • Progress indicators during PDF processing    │ │
│  │ • Success haptics + subtle animation on actions│ │
│  │ • Pull-to-refresh spinner                      │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│  4. GESTURE-DRIVEN INTERACTIONS                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ • Swipe to go back (already partially done)    │ │
│  │ • Long-press for context menu                  │ │
│  │ • Double-tap to zoom document                  │ │
│  │ • Shake to undo (gimmick but memorable)        │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
└──────────────────────────────────────────────────┘
```

### New/Changed Files

| File | Change |
|------|--------|
| **`src/components/ui/sheet.tsx`** | Already exists (shadcn). Enhance with native-style drag handle, snap points, backdrop blur |
| **`src/components/BottomSheet.tsx`** (new) | Reusable bottom sheet wrapper: drag handle, snap to half/full, backdrop, Framer Motion spring |
| **`src/components/SettingsSheet.tsx`** (new) | Settings as bottom sheet (replace dialog) |
| **`src/components/ImageCropSheet.tsx`** (new) | Crop as bottom sheet (replace dialog) |
| **`src/components/Skeleton.tsx`** (new) | Reusable skeleton primitives: SkeletonText, SkeletonCard, SkeletonCircle |
| **`src/components/DocumentUpload.tsx`** | Add skeleton while file processes |
| **`src/components/DocumentViewer.tsx`** | Add skeleton during PDF load + progress bar during signing |
| **`src/components/SignatureCreator.tsx`** | Add skeleton while image processes |
| **`src/pages/History.tsx`** | Add pull-to-refresh via custom hook |
| **`src/pages/Index.tsx`** | Replace dialog-style components with sheets; add swipe-back between steps |
| **`src/hooks/usePullToRefresh.ts`** (new) | Touch-based pull-to-refresh with spring animation |
| **`src/index.css`** | Add `.sheet-backdrop`, `.drag-handle`, `.skeleton-shimmer` CSS |
| **`src/components/ActionBar.tsx`** | Native-style tab indicator (pill shape, spring animation) |

### Bottom Sheet Spec

```typescript
interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  snapPoints?: ('half' | 'full')[];
  defaultSnap?: 'half' | 'full';
  showHandle?: boolean;
  children: ReactNode;
}
```

Implementation using `vaul` (already in dependencies):
```tsx
import { Drawer } from "vaul";

<Drawer.Root open={open} onClose={onClose}>
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
    <Drawer.Content className="fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl max-h-[90vh]">
      <div className="mx-auto w-12 h-1.5 bg-muted-foreground/30 rounded-full my-3" />
      {children}
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

### Pull-to-Refresh Hook

```typescript
function usePullToRefresh(
  containerRef: RefObject<HTMLDivElement>,
  onRefresh: () => Promise<void>,
  options?: { threshold?: number; disabled?: boolean }
): { refreshing: boolean; pullDistance: number }
```

Pure touch-event implementation:
- `touchstart`: record start Y if scrollTop === 0
- `touchmove`: track pull distance with rubber-band easing
- `touchend`: if distance > threshold (80px), trigger refresh; animate spinner
- Returns `pullDistance` for rendering the pull indicator

### Skeleton System

```typescript
// Reusable skeleton components
<SkeletonText lines={3} />
<SkeletonCard height={120} />
<SkeletonCircle size={48} />
```

Uses Tailwind `animate-pulse` with `bg-muted` — zero JS, pure CSS shimmer effect via keyframes.

### Navigation Transitions

Replace Framer Motion page transitions with native-feel stack:
```typescript
// Forward: slide from right
// Back: slide to right
// Modal/sheet: slide up from bottom
const screenVariants = {
  enter: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '100%' : '-30%',
    opacity: direction === 'forward' ? 0 : 1,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: 'forward' | 'back') => ({
    x: direction === 'forward' ? '-30%' : '100%',
    opacity: direction === 'forward' ? 1 : 0,
  }),
};
```

---

## Pillar 4: Offline-First Marketing

### Current State
Offline capability exists but is invisible to users. No indication that the app works offline beyond a small status badge.

### Target State
Offline-first is a prominently marketed feature — users know and trust it before they even need it.

### Implementation

#### 4.1 Marketing Landing Page

**File: `src/pages/Landing.tsx`** (new)

Route: `/` (unauthenticated), `/welcome` (authenticated)

Sections:
1. **Hero**: "Sign Documents. Anywhere. Even Offline." + device mockup + [Get Started] CTA
2. **Feature grid**: 6 cards — Offline-first, No account needed, 5 field types, .docx support, Biometric lock, Free forever
3. **Comparison table**: SignDocu vs DocuSign/Adobe/Dropbox — Offline, Price, Formats, Privacy
4. **How it works**: 3-step animated flow (Upload → Sign → Done)
5. **Trust signals**: "Your documents never leave your device", SHA-256 audit trail, optional cloud sync
6. **CTA footer**: [Start Signing Free] → redirects to Index

**File: `src/App.tsx`** changes:
```tsx
<Route path="/" element={user ? <Index /> : <Landing />} />
<Route path="/app" element={<ProtectedRoute><Index /></ProtectedRoute>} />
```

#### 4.2 In-App Offline Awareness

| Component | Change |
|-----------|--------|
| **`ActionBar.tsx`** | Pulsing "Works Offline" badge when online (reassurance), solid "Offline Mode" badge when offline |
| **`Index.tsx`** | First-time toast: "🔒 Your documents stay on your device — no cloud required" |
| **`SettingsDialog.tsx`** | "Offline Status" card with last sync time, cached doc count, clear cache button |
| **`DocumentUpload.tsx`** | When offline: "Offline — document will sync when you're back online" banner |

#### 4.3 Offline Demo/Tutorial (First-Run)

**File: `src/components/OfflineDemo.tsx`** (new)

Shown on first visit or when settings reset:
1. "Turn off your WiFi — SignDocu keeps working"
2. Interactive demo: upload → sign → download, all with a "offline simulator" toggle
3. "See? No internet needed. Your documents, your device, your control."

#### 4.4 App Store / Play Store Assets

Create directory: `marketing/` with:
- `feature-graphic.png` (1024×500): "Sign documents offline" + phone mockup
- `screenshots/` — 8 screenshots showing key flows with offline badge visible
- `short-description.txt`: "Free document signing that works without internet. PDF, Word & images. Draw or type signatures. Your data stays on your device."

#### 4.5 PWA Install Prompt

**File: `src/lib/pwaInstall.ts`** (new)

Detects `beforeinstallprompt` event, shows custom install banner:
> "Install SignDocu — works offline, no account needed"
> [Install] [Not now]

Uses `vite-plugin-pwa` (already installed) configuration in `vite.config.ts`.

---

## Implementation Order & Dependencies

```
Phase 1 (Week 1-2): One-Tap Signing
├── userProfile.ts (IndexedDB)
├── QuickSignOverlay.tsx (bottom sheet)
├── SignatureCreator quickMode
├── Index.tsx quickSign flow
└── useSignaturePlacement autoPlaceDefault

Phase 2 (Week 2-4): Native Mobile UX
├── BottomSheet.tsx + vaul integration
├── Convert modals/dialogs → sheets
├── Skeleton system
├── Pull-to-refresh hook
├── Native navigation transitions
└── ActionBar native-style tabs

Phase 3 (Week 4-6): Multi-Party Signing
├── Supabase schema migration
├── multiPartySigning.ts core logic
├── RecipientManager.tsx
├── SignRecipient.tsx page
├── App.tsx route + share token logic
└── Real-time status via Supabase subscriptions

Phase 4 (Week 6-7): Offline-First Marketing
├── Landing.tsx page
├── In-app offline awareness badges
├── OfflineDemo.tsx first-run tutorial
└── PWA install prompt
```

### Dependency Graph

```
One-Tap Signing ──┐
                  ├──> Multi-Party Signing (uses bottom sheets + quick flow)
Native Mobile UX ─┘

Offline Marketing ── (independent, can run in parallel)
```

---

## Files Summary

### New Files (16)

| File | Pillar | Purpose |
|------|--------|---------|
| `src/lib/userProfile.ts` | P1 | Profile storage with IndexedDB |
| `src/components/QuickSignOverlay.tsx` | P1 | One-tap signing bottom sheet |
| `src/components/BottomSheet.tsx` | P3 | Reusable bottom sheet component |
| `src/components/SettingsSheet.tsx` | P3 | Settings as bottom sheet |
| `src/components/ImageCropSheet.tsx` | P3 | Crop as bottom sheet |
| `src/components/Skeleton.tsx` | P3 | Skeleton loading primitives |
| `src/hooks/usePullToRefresh.ts` | P3 | Pull-to-refresh gesture hook |
| `src/lib/multiPartySigning.ts` | P2 | Multi-party signing core logic |
| `src/components/RecipientManager.tsx` | P2 | Recipient assignment UI |
| `src/components/document-viewer/RecipientBadge.tsx` | P2 | Field ownership badge |
| `src/hooks/useSigningSession.ts` | P2 | Real-time session subscription |
| `src/pages/SignRecipient.tsx` | P2 | Recipient signing page |
| `src/pages/Landing.tsx` | P4 | Marketing landing page |
| `src/components/OfflineDemo.tsx` | P4 | First-run offline tutorial |
| `src/lib/pwaInstall.ts` | P4 | PWA install prompt logic |
| `supabase/functions/send-invitation/index.ts` | P2 | Email invitation Edge Function |

### Modified Files (14)

| File | Pillar | Change |
|------|--------|--------|
| `src/pages/Index.tsx` | P1, P2 | Quick sign flow + multi-party toggle |
| `src/components/SignatureCreator.tsx` | P1 | Quick mode (skip method picker) |
| `src/hooks/useSignaturePlacement.ts` | P1, P2 | Auto-place + recipient ownership |
| `src/components/DocumentViewer.tsx` | P1, P2 | Quick sign props + recipient filtering |
| `src/components/ActionBar.tsx` | P1, P3, P4 | Quick sign toggle + native tabs + offline badge |
| `src/components/DocumentUpload.tsx` | P3 | Skeleton loading |
| `src/components/SettingsDialog.tsx` | P3, P4 | Convert to sheet + offline status card |
| `src/App.tsx` | P2, P4 | SignRecipient route + Landing route |
| `src/lib/pdfSigner.ts` | P2 | Add recipientId to SignaturePlacement |
| `src/lib/signatureStorage.ts` | P1 | Add isDefault flag |
| `src/components/document-viewer/SignaturePlacementLayer.tsx` | P2 | Recipient dimming + badges |
| `src/index.css` | P3 | Sheet styles + skeleton shimmer + native transitions |
| `supabase-schema.sql` | P2 | Signing sessions + participants tables |
| `src/pages/History.tsx` | P3 | Pull-to-refresh |

### Total Impact
- **16 new files**
- **14 modified files**
- **30 files total across 4 pillars**
- **~2,500 lines of new code** (estimate)
