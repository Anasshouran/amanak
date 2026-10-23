import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import type { OrgAuditEntry } from "@amanak/shared-types"
import { useContext_ } from "../../design/ContextProvider"
import { useLocale, useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"

export function OrgAuditScreen() {
  const { contextId, organizations } = useContext_()
  const { isRTL } = useLocale()
  const tokens = useTokens()
  const t = useT()
  const [rows, setRows] = useState<OrgAuditEntry[]>([])

  const role = (organizations ?? []).find((o) => o.id === contextId)?.role
  const allowed = role === "owner" || role === "admin" || role === "auditor"

  useEffect(() => {
    if (!contextId || !allowed) return
    api.listOrgAudit(contextId, { limit: 50 }).then((r: any) => {
      setRows(r?.results ?? r ?? [])
    }).catch(() => setRows([]))
  }, [contextId, allowed])

  if (!contextId || !allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.c.bg, padding: tokens.space[4] }}>
        <Text style={{ color: tokens.c.muted }}>{t("common.error")}</Text>
      </View>
    )
  }

  const align = isRTL ? "right" : "left"

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tokens.c.bg }} contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[3] }}>
      <Text style={{ fontSize: tokens.size["2xl"], fontWeight: "700", color: tokens.c.textStrong, textAlign: align }}>
        {t("org.audit.title")}
      </Text>
      {rows.length === 0 ? (
        <Text style={{ color: tokens.c.muted, textAlign: align }}>{t("org.audit.empty")}</Text>
      ) : (
        rows.map((r) => (
          <View key={r.id} style={{ backgroundColor: tokens.c.surface, borderColor: tokens.c.border, borderWidth: 1, borderRadius: tokens.radius.md, padding: tokens.space[3], gap: tokens.space[1] }}>
            <Text style={{ color: tokens.c.textStrong, textAlign: align, fontWeight: "600" }}>
              {t(`org.audit.action.${r.action}`) || r.action}
            </Text>
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: align }}>
              {r.actor ? r.actor.email : "—"} · {new Date(r.created_at).toLocaleString()}
            </Text>
            {r.target_email ? (
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: align }}>{r.target_email}</Text>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  )
}
