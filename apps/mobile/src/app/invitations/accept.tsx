import { useLocalSearchParams, useRouter } from "expo-router"
import { InvitationsAcceptScreen } from "../../src/components/org/InvitationsAcceptScreen"

/**
 * Deep-link landing route: `/invitations/accept?token=…`.
 * The token arrives either from the invite email or from a push notification.
 */
export default function InvitationsAcceptRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>()
  const router = useRouter()
  return (
    <InvitationsAcceptScreen
      token={typeof token === "string" ? token : ""}
      onDone={() => router.replace("/org")}
    />
  )
}
