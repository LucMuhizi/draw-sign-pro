import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.app',
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
  },
};

export default config;
