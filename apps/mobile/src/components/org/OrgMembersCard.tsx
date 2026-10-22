import { useCallback, useEffect, useState } from "react"
import { Pressable, Text, TextInput, View } from "react-native"
import type { OrgMemberRow } from "@amanak/shared-types"
import { useLocale, useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"

type Invitation = {
  id: number
  email: string
  role: string
  status: string
  expires_at: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Who may invite / revoke / change roles. Auditors are read-only. */
export function canManageMembers(role?: string): boolean {
  return role === "owner" || role === "admin"
}

/**
 * P18.3 — mobile members card.
 *
 * Owners and admins can invite by email and revoke pending invitations;
 * everyone who may see members gets the read-only list. The role picker
 * offers `admin` only to owners, matching the backend rules.
 */
export function OrgMembersCard({
  orgId,
  role,
  members,
  onChanged,
}: {
  orgId: string
  role?: string
  members: OrgMemberRow[]
  onChanged?: () => void
}) {
  const t = useT()
  const tokens = useTokens()
  const { isRTL } = useLocale()
  const manage = canManageMembers(role)
  const isOwner = role === "owner"

  const [pending, setPending] = useState<Invitation[]>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("employee")
  const [emailError, setEmailError] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  const roleOptions = ["employee", "analyst", "auditor", ...(isOwner ? ["admin"] : [])]

  const loadPending = useCallback(() => {
    if (!manage || !orgId) return
    // Defer through a promise so a missing/transient client method rejects
    // (and is handled) instead of throwing synchronously during the effect.
    Promise.resolve()
      .then(() => api.get<Invitation[]>(`/organizations/${orgId}/invitations/`))
      .then((rows) => setPending(Array.isArray(rows) ? rows : []))
      .catch(() => setPending([]))
  }, [manage, orgId])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  async function submitInvite() {
    setEmailError("")
    setNotice("")
    if (!EMAIL_RE.test(email)) {
      setEmailError(t("org.invite.invalid_email"))
      return
    }
    setBusy(true)
    try {
      await api.post(`/organizations/${orgId}/members/invite/`, {
        email,
        role: inviteRole,
      })
      setNotice(t("org.invite.success"))
      setEmail("")
      setInviteRole("employee")
      setInviteOpen(false)
      loadPending()
      onChanged?.()
    } catch (e: any) {
      setNotice(e?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: number) {
    setBusy(true)
    setNotice("")
    try {
      await api.delete(`/organizations/${orgId}/invitations/${id}/`)
      setPending((rows) => rows.filter((r) => r.id !== id))
    } catch (e: any) {
      setNotice(e?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  const align = isRTL ? "right" : "left"

  return (
    <View
      style={{
        backgroundColor: tokens.c.surface,
        borderColor: tokens.c.border,
        borderWidth: 1,
        borderRadius: tokens.radius.md,
        padding: tokens.space[4],
        gap: tokens.space[2],
      }}
    >
      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontSize: tokens.size.md,
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: align,
          }}
        >
          {t("org.dashboard.members")}
        </Text>
        {manage && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setInviteOpen((open) => !open)}
          >
            <Text style={{ color: tokens.c.accent, fontWeight: "600" }}>
              + {t("org.members.invite")}
            </Text>
          </Pressable>
        )}
      </View>

      {!!notice && (
        <Text accessibilityRole="alert" style={{ color: tokens.c.muted, textAlign: align }}>
          {notice}
        </Text>
      )}

      {inviteOpen && manage && (
        <View style={{ gap: tokens.space[2], marginVertical: tokens.space[2] }}>
          <Text style={{ color: tokens.c.text, textAlign: align }}>
            {t("org.invite.email")}
          </Text>
          <TextInput
            accessibilityLabel={t("org.invite.email")}
            value={email}
            onChangeText={(v) => {
              setEmail(v)
              if (emailError) setEmailError("")
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            style={{
              borderWidth: 1,
              borderColor: tokens.c.border,
              borderRadius: tokens.radius.sm,
              padding: tokens.space[2],
              color: tokens.c.text,
            }}
          />
          {!!emailError && (
            <Text accessibilityRole="alert" style={{ color: "#c0392b" }}>
              {emailError}
            </Text>
          )}
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", gap: tokens.space[2] }}>
            {roleOptions.map((r) => (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityState={{ selected: inviteRole === r }}
                onPress={() => setInviteRole(r)}
                style={{
                  paddingHorizontal: tokens.space[3],
                  paddingVertical: tokens.space[1],
                  borderRadius: tokens.radius.sm,
                  borderWidth: 1,
                  borderColor: inviteRole === r ? tokens.c.accent : tokens.c.border,
                }}
              >
                <Text
                  style={{
                    color: inviteRole === r ? tokens.c.accent : tokens.c.text,
                    fontSize: tokens.size.xs,
                  }}
                >
                  {t(`org.invite.role.${r}`)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={submitInvite}
            style={{ opacity: busy ? 0.5 : 1 }}
          >
            <Text style={{ color: tokens.c.accent, fontWeight: "600", textAlign: align }}>
              {t("org.invite.submit")}
            </Text>
          </Pressable>
        </View>
      )}

      {members.length === 0 ? (
        <Text style={{ color: tokens.c.muted }}>—</Text>
      ) : (
        members.map((m) => (
          <View
            key={m.user_id}
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: "space-between",
              paddingVertical: tokens.space[2],
              borderTopWidth: 1,
              borderTopColor: tokens.c.border,
            }}
          >
            <Text style={{ color: tokens.c.text, textAlign: align }}>
              {m.display_name || m.email}
            </Text>
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>
              {t(`org.members.role.${m.role}`)}
            </Text>
          </View>
        ))
      )}

      {manage && pending.length > 0 && (
        <View style={{ marginTop: tokens.space[2], gap: tokens.space[1] }}>
          <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: align }}>
            {t("org.members.pending")}
          </Text>
          {pending.map((inv) => (
            <View
              key={inv.id}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: tokens.c.text, fontSize: tokens.size.sm }}>
                {inv.email}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => revoke(inv.id)}
              >
                <Text style={{ color: "#c0392b", fontSize: tokens.size.xs }}>
                  {t("org.invitations.revoke")}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
