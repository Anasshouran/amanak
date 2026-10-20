import { lazy, Suspense } from "react"
import { Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { Landing } from "./pages/Landing"
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
const SecurityActivity = lazy(() => import("./pages/SecurityActivity"))
import { Pricing } from "./pages/Pricing"
import { Billing } from "./pages/Billing"
import { Settings } from "./pages/Settings"
import { NotFound } from "./pages/NotFound"
import { OrgDashboard } from "./pages/OrgDashboard"
import { StaffRoute } from "./components/StaffRoute"
import { StaffHome } from "./pages/StaffHome"
import { StaffUsers } from "./pages/StaffUsers"
import { StaffUserDetail } from "./pages/StaffUserDetail"
import { StaffSubscriptions } from "./pages/StaffSubscriptions"
import { StaffAnnouncements } from "./pages/StaffAnnouncements"
import { Notifications } from "./pages/Notifications"
import { StaffAudit } from "./pages/StaffAudit"
import { StaffTickets } from "./pages/StaffTickets"
import { StaffTicketDetail } from "./pages/StaffTicketDetail"
import { StaffMetrics } from "./pages/StaffMetrics"

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
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
        <Route path="/security" element={<Suspense fallback={null}><SecurityActivity /></Suspense>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/plans" element={<Pricing />} />
        <Route path="/billing" element={<Billing />} />
        <Route
          path="/staff"
          element={
            <StaffRoute>
              <StaffHome />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/users"
          element={
            <StaffRoute>
              <StaffUsers />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/users/:id"
          element={
            <StaffRoute>
              <StaffUserDetail />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/audit"
          element={
            <StaffRoute>
              <StaffAudit />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/tickets"
          element={
            <StaffRoute>
              <StaffTickets />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/tickets/:id"
          element={
            <StaffRoute>
              <StaffTicketDetail />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/metrics"
          element={
            <StaffRoute>
              <StaffMetrics />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/subscriptions"
          element={
            <StaffRoute>
              <StaffSubscriptions />
            </StaffRoute>
          }
        />
        <Route
          path="/staff/announcements"
          element={
            <StaffRoute>
              <StaffAnnouncements />
            </StaffRoute>
          }
        />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/org" element={<OrgDashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
