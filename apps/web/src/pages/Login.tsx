import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../state/AuthContext"
import type { ApiError } from "@amanak/api-client"

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError((err as ApiError).message ?? "Login failed")
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: "0.75rem" }}
    >
      <h2>Sign in to AMANAK</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Sign in</button>
      <p>
        No account? <Link to="/register">Register</Link>
      </p>
    </form>
  )
}