interface AIExplanationProps {
  text?: string | null
  provider?: string | null
  model?: string | null
  loading?: boolean
  error?: string | null
}
export function AIExplanation({ text, provider, model, loading, error }: AIExplanationProps) {
  if (loading) return <div data-testid="ai-loading">Explaining…</div>
  if (error) return <div>{error}</div>
  return (
    <div data-testid="ai-explanation">
      <h3>💡 AI Explanation</h3>
      <p>{text}</p>
      {provider && <span>Powered by: {provider}</span>}
    </div>
  )
}
