import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use relative paths for Capacitor compatibility
  base: "./",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Don't externalize Capacitor modules - they need to be bundled
    // Capacitor provides the runtime bridge, but the imports need to be resolved
    rollupOptions: {
      // Removed external config - let Vite bundle everything
    },
  },
  optimizeDeps: {
    // Ensure Capacitor modules are pre-bundled during dev
    include: ["@capacitor/core", "@capacitor/filesystem", "@capacitor/camera"],
  },
}));
