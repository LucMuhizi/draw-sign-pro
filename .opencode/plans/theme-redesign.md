# Theme Redesign Plan: Sunny Sky with Dope Animations

## Current Issues
1. **Washed-out light theme** — pale blue `hsl(210 45% 95%)` background looks generic
2. **Basic animations** — simple `opacity: 0 → 1` fade-in-up on everything
3. **Flat particles** — tiny blue dots on white background don't pop
4. **Boring buttons** — gradient rectangles with no personality
5. **No micro-interactions** — no hover effects, no click feedback, no spring physics

## Design Direction: "Glassmorphism Sky"
A vibrant, modern theme with animated gradient backgrounds, glassmorphism cards, and spring-physics interactions. Think: iOS/macOS blur effects meets modern web design.

---

## Plan

### Step 1: New Color System (`index.css` + `tailwind.config.ts`)

**Light Mode (default):**
- Background: `hsl(210 40% 98%)` — near-white with blue tint
- Cards: `hsl(0 0% 100%)` with `backdrop-blur-xl` — frosted glass
- Primary: `hsl(217 91% 60%)` — vibrant blue (like iOS blue)
- Accent: `hsl(25 95% 53%)` — warm orange for CTAs
- Secondary: `hsl(199 89% 48%)` — cyan for secondary actions
- Success: `hsl(142 71% 45%)` — green
- Muted: `hsl(210 40% 96%)` — light gray-blue

**Background Gradient:**
```css
body {
  background: linear-gradient(135deg, hsl(210 100% 97%) 0%, hsl(199 100% 94%) 50%, hsl(25 100% 97%) 100%);
}
```

**Animated Gradient Orbs (CSS):**
```css
.bg-orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.5;
  animation: float 8s ease-in-out infinite;
}
.bg-orb-1 { background: hsl(217 91% 60%); top: -10%; left: -5%; }
.bg-orb-2 { background: hsl(199 89% 48%); bottom: -10%; right: -5%; animation-delay: -4s; }
.bg-orb-3 { background: hsl(25 95% 53%); top: 50%; left: 50%; animation-delay: -2s; }
```

### Step 2: Animated Background (`ParticleBackground.tsx`)

Replace the tiny dot particles with **larger, slower-moving orbs** using Three.js:
- Increase particle size from `0.06` to `0.15`
- Add color variation (blue, cyan, orange tints)
- Slower movement for a more ambient feel
- Reduce count to ~60 for performance

### Step 3: Cool Button Animations

**Spring Physics on All Buttons:**
```tsx
<motion.button
  whileHover={{ scale: 1.05, y: -2 }}
  whileTap={{ scale: 0.95 }}
  transition={{ type: "spring", stiffness: 400, damping: 17 }}
>
```

**Magnetic Hover Effect (custom hook):**
```tsx
// Buttons follow cursor slightly when hovering
const [x, y] = useMagnetic(strength: 0.3);
```

**Gradient Border Animation:**
```css
.btn-gradient-border {
  position: relative;
  background: transparent;
}
.btn-gradient-border::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(45deg, #3b82f6, #06b6d4, #f97316, #3b82f6);
  border-radius: inherit;
  z-index: -1;
  background-size: 300% 300%;
  animation: gradient-shift 3s ease infinite;
}
```

### Step 4: Page Transitions (Index.tsx)

Replace simple fade-in-up with **scale + blur** transitions:
```tsx
const pageVariants = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.04, filter: "blur(8px)" },
};
```

### Step 5: Card Hover Effects

All cards get:
- `whileHover={{ y: -4, boxShadow: "0 20px 40px -12px hsl(217 91% 60% / 0.15)" }}`
- Border color shift on hover: `border-primary/20 → border-primary/40`
- Subtle scale on hover: `1 → 1.01`

### Step 6: Step Indicator Enhancement

- Active step: pulsing glow ring animation
- Completed steps: checkmark animates in with spring + rotation
- Connecting line: animated fill from left to right

### Step 7: Upload Area Enhancement

- Dashed border: animated dash offset (marching ants effect)
- On drag: border color shifts to vibrant blue, background pulses
- File icon: bounces when dragging
- Success state: green checkmark with scale-in animation

### Step 8: Signature Creator Cards

- Method cards: slide in from left with stagger
- On hover: card lifts + icon rotates slightly
- Selected state: blue border with glow

### Step 9: Bottom Nav Enhancement

- Active indicator: animated pill that slides between tabs (already has layoutId)
- Add subtle shadow under active icon
- Tab labels: fade in/out with slight y-offset

### Step 10: Toast Notifications

- Slide in from right with spring physics
- Auto-dismiss with progress bar animation
- Success: green accent, Error: red accent

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | New color system, gradient background, animated orbs, custom animations |
| `tailwind.config.ts` | New keyframes, shadows, animations |
| `src/components/ParticleBackground.tsx` | Larger particles, color variation, slower movement |
| `src/pages/Index.tsx` | Scale+blur page transitions, magnetic buttons |
| `src/components/DocumentUpload.tsx` | Marching ants border, drag animations |
| `src/components/SignatureCreator.tsx` | Spring physics on cards, stagger animations |
| `src/components/DocumentViewer.tsx` | Card hover effects, button animations |
| `src/components/ActionBar.tsx` | Nav pill animation, icon effects |
| `src/components/StepIndicator.tsx` | Glow ring, animated checkmark |
| `src/pages/Login.tsx` | Card entrance animation, input focus effects |
| `src/pages/SignUp.tsx` | Same as Login |
| `src/pages/History.tsx` | List item stagger, card hover effects |
| `src/App.tsx` | Default theme → light |

## Implementation Order

1. Color system + background (index.css, tailwind.config.ts)
2. Particle background update
3. Button animations (all components)
4. Page transitions (Index.tsx)
5. Card effects (all components)
6. Step indicator polish
7. Upload area enhancement
8. Signature creator polish
9. Bottom nav polish
10. Build + verify

## Verification
- `npm run build` passes
- All buttons clickable (z-index, pointer-events)
- Animations smooth (60fps)
- Light theme is default
- No console errors
