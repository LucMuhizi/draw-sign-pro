import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.signdocu.app',
  appName: 'SignDocu',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffffff",
      showSpinner: true,
      spinnerColor: "#3b82f6",
    },
    Keyboard: {
      resize: "body",
      style: "DEFAULT",
    },
    StatusBar: {
      style: "DEFAULT",
      backgroundColor: "#ffffff",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
