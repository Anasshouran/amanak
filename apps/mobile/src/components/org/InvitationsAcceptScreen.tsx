import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { useLocale, useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"

type Status = "idle" | "loading" | "ok" | "err"

/**
 * P18.3 — mobile invite landing card.
 *
 * Used by `app/invitations/accept.tsx`, which forwards the `token` query
 * parameter from the deep link. Nothing is accepted until the user taps
 * "Accept": an auto-accept on mount would let link previews join tenants
 * silently.
 */
export function InvitationsAcceptScreen({
  token,
  onDone,
}: {
  token: string
  onDone?: () => void
}) {
  const t = useT()
  const tokens = useTokens()
  const { isRTL } = useLocale()
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  async function accept() {
    setStatus("loading")
    setMessage("")
    try {
      await api.post("/organizations/invitations/accept/", { token })
      setStatus("ok")
      setMessage(t("org.invitations.accept.accepted"))
    } catch (e: any) {
      const code = e?.code
      setStatus("err")
      setMessage(
        code === "invitation_expired" || code === "invitation_used"
          ? t("org.invitations.accept.expired")
          : t("org.invitations.accept.invalid"),
      )
    }
  }

  const align = isRTL ? "right" : "left"

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: tokens.c.bg,
        padding: tokens.space[4],
        justifyContent: "center",
      }}
    >
      <View
        style={{
          backgroundColor: tokens.c.surface,
          borderColor: tokens.c.border,
          borderWidth: 1,
          borderRadius: tokens.radius.md,
          padding: tokens.space[4],
          gap: tokens.space[3],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: tokens.size.lg,
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: align,
          }}
        >
          {t("org.invitations.accept.title")}
        </Text>

        {status === "idle" && (
          <>
            <Text style={{ color: tokens.c.text, textAlign: align }}>
              {t("org.invitations.accept.invited_as")}…
            </Text>
            <Pressable accessibilityRole="button" onPress={accept}>
              <Text style={{ color: tokens.c.brand, fontWeight: "600", textAlign: align }}>
                {t("org.invitations.accept.accept")}
              </Text>
            </Pressable>
          </>
        )}

        {status === "loading" && (
          <Text style={{ color: tokens.c.muted, textAlign: align }}>
            {t("common.loading")}
          </Text>
        )}

        {status === "ok" && (
          <>
            <Text accessibilityRole="alert" style={{ color: tokens.c.text, textAlign: align }}>
              {message}
            </Text>
            <Pressable accessibilityRole="button" onPress={onDone}>
              <Text style={{ color: tokens.c.brand, fontWeight: "600", textAlign: align }}>
                {t("org.dashboard.title")}
              </Text>
            </Pressable>
          </>
        )}

        {status === "err" && (
          <Text accessibilityRole="alert" style={{ color: "#c0392b", textAlign: align }}>
            {message}
          </Text>
        )}
      </View>
    </View>
  )
}
