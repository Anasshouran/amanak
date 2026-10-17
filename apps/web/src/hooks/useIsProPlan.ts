import { api } from "../lib/api"
import { useAsync } from "../lib/useAsync"

/**
 * Whether the current account is on a paid plan. Used to decide whether to
 * surface the sidebar upgrade call-to-action. While loading (or on error) it
 * reports `false`, so the CTA only appears once a paid/free plan is known.
 */
export function useIsProPlan(): boolean {
  const sub = useAsync(() => api.getSubscription())
  return sub.data != null && sub.data.plan.id !== "free"
}
