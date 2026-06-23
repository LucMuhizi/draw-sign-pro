# Premium Animations — "Apple-Wallet Smooth" Signing (v2)

> **Design principle (not decoration):**
> Every animation must reinforce **progress** and **completion**. The goal isn't to look cool — it's to make signing feel *satisfying*. The user should feel the document "landing," the field "filling," the signature "landing," and the export "settling" — all without ever staring at a loading spinner.
>
> **Visual targets:** Apple Wallet · Linear · Arc Search · Notion
> **Visual anti-targets:** DocuSign · Adobe Sign · Generic enterprise dashboards · Legacy PDF editors
>
> **Stack we already have (no new dependencies):**
> - **Framer Motion 12** — used in 13+ files already
> - **Capacitor Haptics 7** — `src/lib/haptics.ts` exports 6 named functions, auto-no-op on web
> - **Sonner** — toast system
> - **CSS animations** — `tailwindcss-animate` + `animate-float`/`animate-pulse` already wired
> - **No new dependencies required.**

---

## Animation System — 10 Moments

### 1. 📄 Document Fold-In — "paper landing on a desk"

**When:** Document first appears (after upload, or when transitioning to the Sign step).

**Animation:**
| Property | From | To | Curve | Duration |
|----------|------|----|----|----------|
| `scale` | 0.95 | 1.0 | spring (stiff 180, damping 22) | **450ms** |
| `y` | +40px | 0 | spring | 450ms |
| `rotateX` | 8° | 0° | spring | 450ms |
| `opacity` | 0 | 1 | ease-out | 300ms |

```tsx
<motion.div
  initial={{ scale: 0.95, y: 40, rotateX: 8, opacity: 0 }}
  animate={{ scale: 1, y: 0, rotateX: 0, opacity: 1 }}
  transition={{
    type: "spring", stiffness: 180, damping: 22, mass: 0.7,
    opacity: { duration: 0.3, ease: "easeOut" },
  }}
  style={{ transformPerspective: 1000, transformOrigin: "center bottom" }}
>
  {/* DocumentViewer content */}
</motion.div>
```

**Triggers:** First mount of `DocumentViewer` with a `selectedFile`. Use `useRef<boolean>` to fire only once per session.

**Files:** `src/components/DocumentViewer.tsx`

---

### 2. 🔍 AI Field Discovery — "light sweep, then marker appears"

**When:** OCR/auto-detect identifies signature/date/initials fields.

**Sequence (one after another, not simultaneously):**
1. A soft horizontal light bar sweeps across the page left→right (350ms)
2. The detected field location glows briefly (250ms)
3. The marker (dashed border) fades in + scales 0.9→1.0 (200ms)
4. Next field's sequence begins after 180ms gap
5. **Order:** Signature → Date → Initials (most-expected first)

**Implementation:** In `src/lib/ocrFields.ts` (or a new wrapper), return a `DetectedField` array with an `index` field. In `SignaturePlacementLayer.tsx`, orchestrate the staggered reveal:

```tsx
// Per-field orchestration
<AnimatePresence>
  {detectedFields
    .filter((f) => f.page === currentPage)
    .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
    .map((field, idx) => (
      <motion.div
        key={field.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: idx * 0.4, duration: 0.2 }}
      >
        {/* Light sweep bar that runs ahead of the marker */}
        <motion.div
          className="absolute h-1 w-1/3 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent pointer-events-none"
          initial={{ x: "-100%" }}
          animate={{ x: "300%" }}
          transition={{ duration: 0.7, delay: idx * 0.4, ease: "easeInOut" }}
        />
        {/* Glow that flashes at the field location */}
        <motion.div
          className="absolute rounded-lg bg-blue-400/30 pointer-events-none"
          style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 0.6, 0], scale: [0.9, 1.1, 1] }}
          transition={{ duration: 0.6, delay: idx * 0.4 + 0.25, times: [0, 0.5, 1] }}
        />
        {/* The actual marker */}
        <motion.div
          className="absolute border-2 border-dashed border-blue-400/60 rounded-lg cursor-pointer"
          style={{ left: field.x, top: field.y, width: field.width, height: field.height }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: idx * 0.4 + 0.45, ease: "easeOut" }}
        />
      </motion.div>
    ))}
</AnimatePresence>
```

**Files:**
- `src/lib/ocrFields.ts` — add `index` to `DetectedField`, ensure `fieldType` is set
- `src/components/document-viewer/SignaturePlacementLayer.tsx` — orchestrate sequenced reveal

---

### 3. ✍️ Signature Ink Animation — "the signature feature"

**When:** User taps "Apply Signature" (or any field is filled).

**Mechanism:** For PNG signatures, we can't use SVG `stroke-dashoffset` directly. So we use SVG's `clipPath` reveal OR convert the PNG to a path on the fly. Two paths:

**Path A (PNG, simplest — 90% of cases):** horizontal clip-path wipe with pen-tip indicator.
**Path B (typed/vector signatures, premium):** true SVG path animation with `strokeDasharray` + `strokeDashoffset`.

**For typed/initials signatures (vector text), we can do TRUE ink writing:**
```tsx
// Convert "John Doe" to an SVG path with stroke-dasharray
<svg viewBox="0 0 200 60" className="w-full h-full">
  <motion.path
    d="M10 30 Q 20 10, 30 30 T 50 30 ..."  // path data for typed text
    stroke="currentColor"
    strokeWidth="2"
    fill="transparent"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: 1 }}
    transition={{ duration: 0.7, ease: "easeInOut" }}
  />
</svg>
```

**For drawn PNG signatures (from `react-signature-canvas`), use clip-path reveal:**
```tsx
<motion.div
  initial={{ clipPath: "inset(0 100% 0 0)" }}
  animate={{ clipPath: "inset(0 0% 0 0)" }}
  transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
>
  <img src={signature} alt="signature" />
</motion.div>
{/* Pen-tip indicator riding the leading edge */}
<motion.div
  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-foreground/40 pointer-events-none"
  initial={{ left: "0%", opacity: 0 }}
  animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
  transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1] }}
/>
```

**On finish:** `hapticSuccess()` fires when the animation completes (use `onAnimationComplete` callback in Framer Motion).

**Files:**
- New: `src/components/animations/InkReveal.tsx` — reusable wrapper, accepts `signatureType: 'png' | 'text'` and dispatches the right reveal
- `src/components/document-viewer/SignaturePlacementLayer.tsx` — wrap field content in `InkReveal`, attach `onAnimationComplete={() => hapticSuccess()}`

---

### 4. ✅ Field Completion Pulse — "tiny success moment"

**When:** Any field transitions from empty → completed (signed, typed, dated, ticked).

**Animation:** 250ms scale punch + color shift to green + checkmark appears.

| Property | From | To | Curve | Duration |
|----------|------|----|----|----------|
| `scale` | 1.0 | 1.15 | 1.0 | spring (stiff 400, damp 15) | **250ms** |
| `borderColor` | blue/primary | green/success | tween | 200ms |
| `backgroundColor` | transparent | green/10 | tween | 200ms |

```tsx
<motion.div
  animate={isCompleted ? {
    scale: [1, 1.15, 1],
    borderColor: ["hsl(var(--primary))", "hsl(142 71% 45%)", "hsl(142 71% 45%)"],
    backgroundColor: ["transparent", "hsl(142 71% 45% / 0.08)", "hsl(142 71% 45% / 0.04)"],
  } : {}}
  transition={{ duration: 0.25, times: [0, 0.5, 1] }}
>
  {isCompleted && (
    <motion.div
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
    >
      <Check className="w-full h-full text-green-600" />
    </motion.div>
  )}
</motion.div>
```

**Trigger:** Wrap the field in a `useEffect` that watches `isCompleted` going `false → true` and replays the animation. Or use a `key` that increments to force a re-mount on completion.

**Files:**
- `src/components/document-viewer/SignaturePlacementLayer.tsx` — implement completion detection + pulse animation

---

### 5. 🎥 Auto-Advance Camera — "the magical one"

**When:** A field is completed, the document viewer automatically pans to the next incomplete field. **This is the killer feature.**

**Sequence (total ~800ms):**
1. Current field scale 1.0 → 1.15 → 1.0 (250ms — the completion pulse from #4)
2. Camera: scale 1.0 → 0.95 (zoom out 200ms) — get the page in frame
3. Pan from current field center to next field center (500ms spring)
4. Camera: scale 0.95 → 1.0 (zoom back in 200ms)
5. Next field glows once (light sweep, #2 mini-version)

**Implementation:** In `Index.tsx` (or a new `useAutoAdvance` hook), track `currentFocusField` and animate the document container's transform:

```tsx
// src/hooks/useAutoAdvance.ts (new)
export function useAutoAdvance(fields: SignaturePlacement[], currentPage: number) {
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; scale: number } | null>(null);

  useEffect(() => {
    if (fields.length === 0) {
      setFocusPoint(null);
      return;
    }
    const next = fields
      .filter((f) => f.page === currentPage)
      .find((f) => !isFieldComplete(f));

    if (next) {
      setFocusPoint({ x: next.x + next.width / 2, y: next.y + next.height / 2, scale: 1.0 });
    }
  }, [fields, currentPage]);

  return { focusPoint };
}

// In DocumentViewer, wrap in motion.div controlled by focusPoint:
<motion.div
  animate={{
    scale: focusPoint?.scale ?? 1,
    x: focusPoint ? -focusPoint.x * 0.1 : 0,  // offset within container
    y: focusPoint ? -focusPoint.y * 0.1 : 0,
  }}
  transition={{ type: "spring", stiffness: 80, damping: 18 }}
>
```

**Files:**
- New: `src/hooks/useAutoAdvance.ts`
- `src/components/DocumentViewer.tsx` — wire focus point to document container
- `src/lib/pdfSigner.ts` — add `isFieldComplete(field)` helper

---

### 6. 🎉 Export Success — "paper dust, not confetti"

**When:** User taps "Download Signed Document" successfully.

**Sequence (~1.1s total):**
1. Document thumbnail in viewer scales 1.0 → 0.7 (300ms spring)
2. Checkmark forms in its place — SVG path animation (`pathLength: 0 → 1`, 250ms)
3. 15-20 small particles ("paper dust") radiate outward from the document center (900ms)
4. `hapticSuccess()` fires
5. Toast appears: "Document signed ✨"

**Particle spec:**
- Count: **15-20** (not 50+ like confetti)
- Size: 2-5px (tiny)
- Colors: muted, document-like — `hsl(var(--muted-foreground))` at varying opacities
- Motion: drift outward 60-100px, with subtle gravity (slight downward bias)
- Fade: opacity 1 → 0 over the duration

```tsx
// src/components/animations/SuccessBurst.tsx (new)
const PARTICLE_COUNT = 18;
const COLORS = [
  "hsl(var(--muted-foreground) / 0.5)",
  "hsl(var(--muted-foreground) / 0.3)",
  "hsl(var(--primary) / 0.4)",
];

export function SuccessBurst({ trigger, origin }) {
  // ... render 18 small particles with random angles, distances, sizes
}
```

**Files:**
- New: `src/components/animations/SuccessBurst.tsx`
- `src/pages/Index.tsx` — wire into download success

---

### 7. 🖱️ Button Physics — "feels responsive"

**When:** Every primary button press.

**Animation (120ms):**
| Frame | Scale |
|-------|-------|
| 0ms (press) | 1.0 |
| 30ms | 0.97 |
| 60ms | 1.03 |
| 90ms | 1.0 |

This is a tiny "anticipation + overshoot" — the button slightly compresses, overshoots, and settles. Subtle, but reads as "physical button."

**Implementation:** A reusable wrapper around `motion.button`:

```tsx
// src/components/animations/PressableButton.tsx (new)
import { motion, HTMLMotionProps } from "framer-motion";

const pressTransition = { duration: 0.12, ease: "easeOut", times: [0, 0.25, 0.5, 1] };
const pressVariants = {
  rest: { scale: 1 },
  pressed: { scale: [1, 0.97, 1.03, 1] },
};

export function PressableButton({ children, ...rest }: HTMLMotionProps<"button">) {
  return (
    <motion.button
      variants={pressVariants}
      initial="rest"
      whileTap="pressed"
      transition={pressTransition}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
```

**Audit targets:** All primary CTAs in `Index.tsx`, `DocumentUpload.tsx`, `ActionBar.tsx`, `DocumentViewer.tsx` (Apply Signature, Download, Add Field, etc.), `StepIndicator.tsx`.

**Files:**
- New: `src/components/animations/PressableButton.tsx`
- ~6-8 button sites across the app — replace `motion.button` with `PressableButton`

---

### 8. 📚 Signature Library — "bottom sheet, not modal"

**When:** User taps to select from saved signatures.

**Animation:**
- The bottom sheet slides up from the bottom (vaul or custom, **300ms ease-out**)
- Each saved signature card animates in with **20ms stagger** (fade + y: +8 → 0)
- Card hover/tap: scale 1 → 0.98 → 1 (uses #7 PressableButton)

**Implementation:** Reuse the existing `BottomSheet` component (shadcn-based) and add staggered card entry:

```tsx
<BottomSheet open={open} onOpenChange={setOpen} title="Choose Signature">
  <motion.div
    initial="hidden"
    animate="visible"
    variants={{ visible: { transition: { staggerChildren: 0.02 } } }}
    className="space-y-2"
  >
    {savedSigs.map((sig) => (
      <motion.div
        key={sig.id}
        variants={{
          hidden: { opacity: 0, y: 8 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <PressableButton onClick={() => onSelect(sig)}>
          {/* signature preview card */}
        </PressableButton>
      </motion.div>
    ))}
  </motion.div>
</BottomSheet>
```

**Files:**
- `src/components/SignatureCreator.tsx` — convert the saved-sig picker to use `BottomSheet` with staggered entry

---

### 9. 👥 Multi-Party Progress Line — "satisfying team progress"

**When:** Multi-party signing session is in progress.

**Visualization:** Horizontal line connecting participant avatars in a sequence. Each avatar has a circular progress ring + status indicator.

**Sequence per sign event:**
1. The signing user's avatar ring fills (200ms)
2. The progress line segment animates from previous to current (350ms)
3. A subtle bounce on the just-filled avatar
4. The next signer's avatar glows (becomes "active")
5. `hapticSuccess()` fires

```tsx
// Per-avatar progress ring (SVG circle with strokeDashoffset)
<svg className="w-12 h-12">
  <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
  <motion.circle
    cx="24" cy="24" r="20" fill="none"
    stroke="hsl(var(--primary))" strokeWidth="3"
    strokeLinecap="round"
    initial={{ pathLength: 0 }}
    animate={{ pathLength: status === "signed" ? 1 : 0 }}
    transition={{ duration: 0.4, ease: "easeInOut" }}
    style={{ rotate: -90, transformOrigin: "center" }}
  />
  <text x="24" y="28" textAnchor="middle" className="text-xs fill-current">
    {initials}
  </text>
</svg>
{/* Connecting line segment */}
<motion.div
  className="h-0.5 bg-primary"
  initial={{ scaleX: 0 }}
  animate={{ scaleX: status === "signed" ? 1 : 0 }}
  transition={{ duration: 0.35, delay: 0.2, ease: "easeOut" }}
  style={{ transformOrigin: "left" }}
/>
```

**Files:**
- `src/components/document-viewer/RecipientBadge.tsx` — extend with progress ring
- `src/pages/Index.tsx` — render the progress line in multi-party mode
- `src/components/RecipientManager.tsx` — show progress to sender

---

### 10. 📡 Offline Indicator — "cloud → device morph, no scary warnings"

**When:** Network status changes (online ↔ offline).

**Offline (connection lost):**
1. The cloud icon in `ActionBar.tsx` morphs into a device icon (400ms spring + path morph)
2. The badge text shifts: "Synced" → "Working Offline" (slide + fade)
3. Badge color shifts from primary (blue) to muted/amber
4. NO scary red warnings, NO blocking dialogs

**Online (connection restored):**
1. The device icon morphs back to cloud (400ms)
2. A subtle ripple emanates from the cloud icon (CSS animation, 600ms)
3. A green checkmark appears in the badge: "Synced" (250ms)
4. Any queued sync items process in the background (existing `syncQueue.ts`)

```tsx
// In ActionBar.tsx
<motion.button
  onClick={toggleOfflineMode}
  className="..."
  whileTap={{ scale: 0.96 }}
>
  <AnimatePresence mode="wait">
    {isOnline ? (
      <motion.div key="cloud" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
        <Cloud className="w-4 h-4" />
      </motion.div>
    ) : (
      <motion.div key="device" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
        <Smartphone className="w-4 h-4" />
      </motion.div>
    )}
  </AnimatePresence>
  <AnimatePresence mode="wait">
    <motion.span key={isOnline ? "online" : "offline"} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 4, opacity: 0 }}>
      {isOnline ? "Synced" : "Working Offline"}
    </motion.span>
  </AnimatePresence>
</motion.button>
```

**For the sync ripple (online→offline→online):**
```css
@keyframes sync-ripple {
  0% { transform: scale(1); opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
.sync-ripple { animation: sync-ripple 0.6s ease-out; }
```

**Files:**
- `src/components/ActionBar.tsx` — implement icon morph + text swap
- `src/index.css` — `sync-ripple` keyframes + reduced-motion guard

---

## Haptic Strategy (consistent across all moments)

| Moment | Haptic | Why |
|--------|--------|-----|
| **Button press** | `hapticLight` | Confirms the press registered |
| **Field placement** | `hapticMedium` | Substantive action — a field is being dropped |
| **Field completion** | `hapticSuccess` | The win moment — distinct beat from placement |
| **Checkbox tick** | `hapticMedium` | Definitive action |
| **Page turn** | `hapticTick` (new) | Subtle progress feedback |
| **Export success** | `hapticSuccess` | The grand finale |
| **Offline** | `hapticLight` | Reassurance, not alarm |
| **Sync complete** | `hapticSuccess` | Trust reinforcement |
| **Error** | `hapticError` | Already exists |

Add `hapticTick` to `src/lib/haptics.ts` as a named export (alias for `hapticLight`, but intent-revealing at call sites).

---

## Implementation Order (your spec)

The first three = single day of work for big perceived-quality lift. The last three = memorable moments.

| Phase | What | Time | Impact |
|-------|------|------|--------|
| **1. Button physics** | `PressableButton` + audit ~6-8 sites | 2h | High — feels right everywhere |
| **2. Field completion pulse** | `#4` in `SignaturePlacementLayer` | 1.5h | High — clear "I did it" feedback |
| **3. Haptic confirmations** | `hapticTick` + wire into 5 moments | 1h | High — silent premium feel |
| **4. Signature ink reveal** | `InkReveal` component + `onAnimationComplete` → haptic | 2h | **Highest** — the signature feature |
| **5. Auto-advance camera** | `useAutoAdvance` hook + transform on container | 3h | **Highest** — the magic |
| **6. AI field discovery** | Sequenced light-sweep in `SignaturePlacementLayer` | 2.5h | High — feels intelligent |
| **7. Export success particles** | `SuccessBurst` + wire to download | 2h | High — the finale |
| **8. Document fold-in** | `motion.div` wrap on viewer mount | 1h | Medium — soft entry, but only fires once |

**Total: ~15 hours. No new dependencies.**

---

## Files Summary

### New files (5)
| File | Purpose |
|------|---------|
| `src/components/animations/InkReveal.tsx` | Signature ink reveal (PNG clip-path + text SVG path) |
| `src/components/animations/PressableButton.tsx` | Reusable button with 1→0.97→1.03→1 physics |
| `src/components/animations/SuccessBurst.tsx` | Paper-dust particles on export |
| `src/hooks/useAutoAdvance.ts` | Camera-pan orchestration between fields |
| `plans/premium-animations.md` | This plan |

### Modified files (~10)
| File | Animations |
|------|------------|
| `src/components/DocumentViewer.tsx` | #1 (fold-in), #5 (auto-advance) |
| `src/components/document-viewer/SignaturePlacementLayer.tsx` | #2 (light sweep), #3 (ink reveal), #4 (completion pulse) |
| `src/components/SignatureCreator.tsx` | #8 (bottom sheet library) |
| `src/components/ActionBar.tsx` | #7 (PressableButton on tabs), #10 (offline morph) |
| `src/components/document-viewer/RecipientBadge.tsx` | #9 (progress ring) |
| `src/components/RecipientManager.tsx` | #9 (progress line) |
| `src/pages/Index.tsx` | #6 (SuccessBurst on download), #9 (progress line) |
| `src/lib/haptics.ts` | Add `hapticTick()` named export |
| `src/lib/ocrFields.ts` | Add `index` to `DetectedField` for sequencing |
| `src/index.css` | `field-pulse`, `sync-ripple` keyframes + reduced-motion guards |
| Various button sites | Replace `motion.button` with `PressableButton` (~6-8 sites) |

### Total impact
- **5 new files**
- **~11 modified files**
- **~900 lines of new code** (estimate)
- **0 new dependencies**
- **GPU-accelerated throughout** — all transforms use `transform` + `opacity` (never `width`/`height`/`top`)

---

## Acceptance Criteria

Each animation should pass a "feel" test before moving to the next.

| # | Moment | Test |
|---|--------|------|
| 1 | **Fold-in** | Upload a PDF → viewer scales 0.95→1, lifts from y+40, flattens from rotateX 8°, in ~450ms. Feels like paper landing. Does NOT replay on re-render. |
| 2 | **Field discovery** | Tap "Auto-detect" → see light sweep → field glows → marker appears. Signature fields appear first, then date, then initials, with 400ms gaps. |
| 3 | **Ink reveal** | Place a signature → the signature image/vector writes itself over 700ms. On finish, `hapticSuccess` fires (Android only — silent on web). |
| 4 | **Completion pulse** | Tick a checkbox → marker scales 1→1.15→1, border turns green, checkmark appears. 250ms total. |
| 5 | **Auto-advance** | Place a signature on field 1 → document zooms out slightly → pans to field 2 → zooms back in. ~800ms. Next field glows. |
| 6 | **Export success** | Download signed doc → document shrinks → checkmark forms → 18 paper-dust particles drift outward → `hapticSuccess` fires. ~1.1s total. |
| 7 | **Button physics** | Press any primary button → see the 1→0.97→1.03→1 anticipation+overshoot. 120ms total. |
| 8 | **Signature library** | Tap saved sigs → bottom sheet slides up → cards fade in with 20ms stagger. |
| 9 | **Multi-party line** | Sender watches progress: each signer's avatar ring fills + line animates + next signer highlights. |
| 10 | **Offline morph** | Disable network → cloud icon morphs to device icon, "Synced" → "Working Offline" with no scary color. Re-enable → device morphs back to cloud, ripple animates, "Synced" reappears. |
| 11 | **Reduced motion** | With `prefers-reduced-motion: reduce`, all CSS animations disable. Framer Motion respects this by default. |
| 12 | **Performance** | No jank on low-end Android. All animations GPU-accelerated. |

---

## Why this works (product strategy, not decoration)

The user already articulated the strategy perfectly:

> *"The goal isn't: make it look cool. The goal is: make signing feel satisfying."*

**Emotional beats the user should feel in order:**
1. **Confidence** — the document lands, feels physical, real
2. **Recognition** — the AI finds the right fields, feels intelligent
3. **Ownership** — the signature writes itself, feels like *my* mark
4. **Achievement** — the field pulses green, I completed something
5. **Flow** — the camera carries me to the next field, I'm guided
6. **Closure** — the document shrinks, dust settles, haptic confirms

DocuSign/Adobe Sign compete on **features** (templates, webhooks, SSO) — features we can never beat. The moat for SignDocu is **feel**. A user who signs one document with SignDocu and one with DocuSign will remember SignDocu.

**The signature ink reveal (#3) and the auto-advance camera (#5) are the two moments users will tell their friends about.** Invest there first when the project lands.
