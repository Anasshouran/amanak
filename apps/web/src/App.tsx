import { lazy, Suspense } from "react"
import { Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
import { Dashboard } from "./pages/Dashboard"
import { Accounts } from "./pages/Accounts"
import { Devices } from "./pages/Devices"
import { Incidents } from "./pages/Incidents"
import { Scanner } from "./pages/Scanner"
import { AIAssistant } from "./pages/AIAssistant"
import { BreachMonitor } from "./pages/BreachMonitor"
import { TwoFactor } from "./pages/TwoFactor"
import { PasswordVault } from "./pages/PasswordVault"
const Family = lazy(() => import("./pages/Family"))
const Awareness = lazy(() => import("./pages/Awareness"))
import { Settings } from "./pages/Settings"
import { NotFound } from "./pages/NotFound"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/devices" element={<Devices />} />
        <Route path="/incidents" element={<Incidents />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/breach" element={<BreachMonitor />} />
        <Route path="/vault" element={<TwoFactor />} />
        <Route path="/passwords" element={<PasswordVault />} />
        <Route path="/family" element={<Suspense fallback={null}><Family /></Suspense>} />
        <Route path="/awareness" element={<Suspense fallback={null}><Awareness /></Suspense>} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
