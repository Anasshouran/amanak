import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../state/AuthContext"
import type { ApiError } from "@amanak/api-client"

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    try {
      await register(email, username, password)
      navigate("/", { replace: true })
    } catch (err) {
      setError((err as ApiError).message ?? "Registration failed")
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      style={{ maxWidth: 360, margin: "4rem auto", display: "grid", gap: "0.75rem" }}
    >
      <h2>Create an AMANAK account</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <button type="submit">Register</button>
      <p>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </form>
  )
}