import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

/**
 * Vite + Vitest config — Phase 1 P1.3 (manualChunks) + P1.6 (test runner).
 *
 * The `manualChunks` heuristic splits heavy vendor code into named chunks
 * so the initial JS payload stays small on mobile (where every kilobyte
 * costs several seconds on cellular). On Capacitor/Android, the bundled
 * offline APK also benefits — the JS groundwork no longer needs to ship
 * one big file.
 *
 * The split is intentionally coarse (5 buckets) rather than per-package:
 *   - pdfjs      — pdfjs-dist + react-pdf (used only on `add-signature`)
 *   - mammoth    — used only for .docx upload
 *   - tesseract  — used only when OCR Auto-detect is clicked
 *   - motion     — framer-motion (used everywhere but very heavy)
 *   - radix      — all @radix-ui/* combined (low individual value, group
 *                  splitting is fine)
 *   - capacitor  — all Capacitor + plugin code (tree-shaken on web)
 *   - query      — @tanstack/react-query (used by App.tsx only)
 *
 * Anything that doesn't match a rule falls into the default chunk — fine
 * for small libs.
 */
export default defineConfig(({ mode }) => ({
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "SignDocu",
        short_name: "SignDocu",
        description: "Sign documents anywhere",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,jpg}"],
        globIgnores: ["**/ort-wasm-simd-threaded.jsep*.wasm", "**/tesseract*"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: { cacheName: "supabase-cache", expiration: { maxEntries: 50, maxAgeSeconds: 86400 } },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Heavy wrappers that should never sit in the initial chunk.
          if (id.includes("pdfjs-dist") || id.includes("react-pdf")) return "pdfjs";
          if (id.includes("mammoth")) return "mammoth";
          if (id.includes("tesseract")) return "tesseract";
          if (id.includes("framer-motion")) return "motion";
          if (id.includes("@radix-ui")) return "radix";
          if (id.includes("@tanstack")) return "query";
          if (
            id.includes("@capacitor") ||
            id.includes("@southdevs") ||
            id.includes("@aparajita")
          )
            return "capacitor";
          // Everything else stays in the default chunk — small enough.
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: ["@capacitor/core", "@capacitor/filesystem", "@capacitor/camera", "@aparajita/capacitor-biometric-auth"],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
  },
}));
