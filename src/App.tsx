import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/lib/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ParticleBackground } from "@/components/ParticleBackground";
import { useEffect } from "react";
import { setupPushListeners, cleanupPushListeners } from "@/lib/pushNotifications";
import { startBackgroundSync, stopBackgroundSync } from "@/lib/syncQueue";
import { ErrorBoundary, installGlobalErrorToasts } from "@/components/ErrorBoundary";
import { track } from "@/lib/telemetry";
import { toast } from "sonner";
import Index from "./pages/Index";
import History from "./pages/History";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import SignRecipient from "./pages/SignRecipient";
import Landing from "./pages/Landing";
import { useAuth } from "@/lib/AuthContext";
import { initPwaInstallListener } from "@/lib/pwaInstall";

const queryClient = new QueryClient();

function MobileInit() {
  useEffect(() => {
    (async () => {
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide();
      } catch {
        // Not running on native
      }
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#ffffff' });
      } catch {
        // Not running on native
      }
      try {
        const { Keyboard } = await import('@capacitor/keyboard');
        Keyboard.addListener('keyboardWillShow', (info: { keyboardHeight: number }) => {
          document.body.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
          document.body.classList.add('keyboard-open');
        });
        Keyboard.addListener('keyboardWillHide', () => {
          document.body.style.removeProperty('--keyboard-height');
          document.body.classList.remove('keyboard-open');
        });
      } catch {
        // Not running on native
      }
      try {
        await setupPushListeners(
          (data) => {
            if (data.documentId) {
              window.dispatchEvent(new CustomEvent('notification-open', { detail: data }));
            }
          },
        );
      } catch {
        // Push not supported
      }
    })();
    return () => { cleanupPushListeners(); stopBackgroundSync(); };
  }, []);
  return null;
}

function AppInit() {
  useEffect(() => {
    startBackgroundSync(async (action) => {
      console.log('Processing sync action:', action.type, action.id);
      return true;
    });
    const cleanupPwa = initPwaInstallListener();

    // Phase 1 P1.2 — install the global error listener that pipes
    // window-level crashes into a dedup'd toast. Wrapped in an effect
    // so SSR / Node test environments don't try to call window APIs.
    const cleanupErrors = installGlobalErrorToasts((msg) => {
      toast.error(msg, { duration: 6000 });
    });

    // Phase 1 P1.5 — fire a single 'app_open' event so the funnel
    // dashboard knows when users actually start using the app.
    track("app_open");

    // Phase 1 P1.5 — opt-in PostHog bootstrap. The module is loaded
    // dynamically and is a no-op without env vars; if the user enables
    // telemetry but forgot to install posthog-js, we log and continue.
    void import("./lib/bootstrapTelemetry").then((m) => m.bootstrapTelemetry());

    return () => {
      stopBackgroundSync();
      cleanupPwa();
      cleanupErrors();
    };
  }, []);
  return null;
}

/**
 * Phase 1 P1.2 — wraps each route in a scoped ErrorBoundary so a render
 * error in /history doesn't take down / or /login.
 *
 * IMPORTANT: This must be declared at module scope. Defining it inside
 * the App component gives it a fresh function identity every render,
 * which causes React to unmount and remount every route on every
 * re-render of App (theme toggle, auth state, drawer state, etc.).
 */
function Routed({ element, scope }: { element: React.ReactNode; scope: string }) {
  return <ErrorBoundary scope={scope}>{element}</ErrorBoundary>;
}

function HomeRoute() {
  const { user } = useAuth();
  return user ? <ProtectedRoute><Index /></ProtectedRoute> : <Landing />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <MobileInit />
          <AppInit />
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <ParticleBackground />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Routed element={<Login />} scope="login" />} />
              <Route path="/signup" element={<Routed element={<SignUp />} scope="signup" />} />
              <Route path="/" element={<Routed element={<HomeRoute />} scope="home" />} />
              <Route path="/app" element={<Routed element={<ProtectedRoute><Index /></ProtectedRoute>} scope="sign" />} />
              <Route path="/history" element={<Routed element={<ProtectedRoute><History /></ProtectedRoute>} scope="history" />} />
              <Route path="/sign/:sessionToken" element={<Routed element={<SignRecipient />} scope="recipient" />} />
              <Route path="*" element={<Routed element={<NotFound />} scope="404" />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
