import { useCallback, useEffect, useState } from "react"

export type AsyncState<T> = {
  data: T | null
  loading: boolean
  error: unknown
  reload: () => void
}

/**
 * Minimal data-fetching hook so every screen can render consistent
 * loading / empty / error states.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    fn()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, reload }
}

export function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { message?: string } | undefined)?.message
  return message && message.trim() ? message : fallback
}

export function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code
}
