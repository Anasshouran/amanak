import { existsSync } from "node:fs"
import { join } from "node:path"
import { defineConfig } from "vitest/config"

/**
 * Test-only module wiring. It introduces **no new dependencies** — every path
 * below is already installed in this workspace.
 *
 * - `react` / `react-dom` are pinned to a single installed copy. Prefer the
 *   local `apps/mobile/node_modules` copy (post-SDK-upgrade installs may place
 *   React there) and fall back to the workspace root. Pinning avoids loading
 *   different React instances (hooks bail out with "Cannot read properties of
 *   null (reading 'useContext')").
 * - `react-native` maps to `react-native-web` because the real `react-native`
 *   entry point ships Flow source that the test transform cannot parse. This
 *   matches the target Expo's `--web` build already ships.
 *
 * Component tests (`.test.tsx`) opt into jsdom with a
 * `/** @vitest-environment jsdom *\/` docblock; the crypto/vault suites stay on
 * the default `node` environment.
 */
const resolvePkg = (pkg: string) => {
  const local = join(__dirname, "node_modules", pkg)
  const workspace = join(__dirname, "..", "..", "node_modules", pkg)
  // Prefer the path that actually contains the package's entry files.
  if (existsSync(join(local, "package.json"))) return local
  if (existsSync(join(workspace, "package.json"))) return workspace
  return local
}

const reactRoot = resolvePkg("react")
const reactDomRoot = resolvePkg("react-dom")

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactRoot },
      { find: /^react\/jsx-runtime$/, replacement: join(reactRoot, "jsx-runtime") },
      { find: /^react\/jsx-dev-runtime$/, replacement: join(reactRoot, "jsx-dev-runtime") },
      { find: /^react-dom$/, replacement: reactDomRoot },
      { find: /^react-dom\/client$/, replacement: join(reactDomRoot, "client") },
      { find: /^react-dom\/test-utils$/, replacement: join(reactDomRoot, "test-utils") },
      { find: /^react-native$/, replacement: "react-native-web" },
      // `@expo/vector-icons` is installed at the workspace root but its compiled
      // `createIconSet.js` is absent here, so tests use a lightweight stub.
      { find: /^@expo\/vector-icons$/, replacement: join(__dirname, "test", "mocks", "vector-icons") },
    ],
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    server: {
      deps: {
        inline: ["react", "react-dom", "react-native-web"],
      },
    },
  },
})
