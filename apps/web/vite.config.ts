import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    // This is a workspace: the root also installs react/react-dom 18.x for the
    // mobile app's hoisted `react-native-web` CJS require(). Without dedupe,
    // vite 7's dep optimizer can pull the root react 18.x into the web bundle
    // while the app imports react 19.x from apps/web → two React copies →
    // "Invalid hook call" at runtime. Force a single copy (the web one).
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
})