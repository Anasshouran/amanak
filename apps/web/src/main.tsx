import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { ToastProvider } from "./design/components"
import { ThemeProvider } from "./design/ThemeProvider"
import { AuthProvider } from "./state/AuthContext"
import { ContextProvider } from "./state/ContextProvider"
import { App } from "./App"
import "./design/global.css"
import "./design/components.css"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ContextProvider>
              <App />
            </ContextProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
