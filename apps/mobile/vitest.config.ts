import { join } from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Test-only module wiring. It introduces **no new dependencies** — every path
 * below is already installed in this workspace.
 *
 * - `react` / `react-dom` are pinned to the single root copy. The hoisted root
 *   holds 18.2.0 while `apps/web` holds 18.3.1; without pinning,
 *   react-native-web and the renderer load different React instances and hooks
 *   bail out with "Cannot read properties of null (reading 'useContext')".
 * - `react-native` maps to `react-native-web` because the real `react-native`
 *   entry point ships Flow source that the test transform cannot parse. This
 *   matches the target Expo's `--web` build already ships.
 *
 * Component tests (`.test.tsx`) opt into jsdom with a
 * `/** @vitest-environment jsdom *\/` docblock; the crypto/vault suites stay on
 * the default `node` environment.
 */
const root = (pkg: string) => join(__dirname, "..", "..", "node_modules", pkg)

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/, replacement: root("react") },
      { find: /^react\/jsx-runtime$/, replacement: root("react/jsx-runtime") },
      { find: /^react\/jsx-dev-runtime$/, replacement: root("react/jsx-dev-runtime") },
      { find: /^react-dom$/, replacement: root("react-dom") },
      { find: /^react-dom\/client$/, replacement: root("react-dom/client") },
      { find: /^react-dom\/test-utils$/, replacement: root("react-dom/test-utils") },
      { find: /^react-native$/, replacement: "react-native-web" },
      // `@expo/vector-icons` is installed at the workspace root but its compiled
      // `createIconSet.js` is absent here, so tests use a lightweight stub.
      { find: /^@expo\/vector-icons$/, replacement: join(__dirname, "test", "mocks", "vector-icons") },    ],
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
})
