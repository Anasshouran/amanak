interface ScannerExplainButtonProps {
  aiEnabled: boolean
  explainBusy?: boolean
  onExplain: () => void
}
export function ScannerExplainButton({ aiEnabled, explainBusy, onExplain }: ScannerExplainButtonProps) {
  return (
    <button
      type="button"
      disabled={!aiEnabled || explainBusy}
      title={!aiEnabled ? "AI is disabled by configuration" : undefined}
      onClick={() => void onExplain()}
    >
      {explainBusy ? "Explaining…" : "Explain this result"}
    </button>
  )
}
