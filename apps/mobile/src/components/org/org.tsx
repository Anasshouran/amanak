import { useEffect, useState } from "react"
import { ScrollView, StyleSheet, Text, View } from "react-native"
import type {
  OrgActivityRow,
  OrgMemberRow,
  OrganizationOverview,
} from "@amanak/shared-types"
import { useContext_ } from "../../design/ContextProvider"
import { useLocale, useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"
import { OrgMembersCard } from "./OrgMembersCard"

/**
 * Mobile organization dashboard (P18.2).
 *
 * Mirrors the web layout: org header, a 2×2 KPI grid, then cards for recent
 * devices, incidents, members and the role-filtered activity feed.
 *
 * Role gating matches the backend:
 * - owner / admin / auditor: everything,
 * - analyst: devices + incidents + activity (no members),
 * - employee: KPIs only (the API 403s on /activity/ and /members/).
 */
export function OrgDashboardScreen() {
  const { contextId, organizations, contextName } = useContext_()
  const { isRTL } = useLocale()
  const tokens = useTokens()
  const t = useT()
  const [overview, setOverview] = useState<OrganizationOverview | null>(null)
  const [members, setMembers] = useState<OrgMemberRow[]>([])
  const [activity, setActivity] = useState<OrgActivityRow[]>([])

  const role = (organizations ?? []).find((o) => o.id === contextId)?.role
  const canSeeMembers = role === "owner" || role === "admin" || role === "auditor"
  const canSeeActivity =
    role === "owner" || role === "admin" || role === "analyst" || role === "auditor"
  // Employees see KPIs only; everyone else also gets the device/incident tables.
  const canSeeTables = canSeeActivity

  useEffect(() => {
    if (!contextId) return
    api.getOrganizationOverview(contextId).then(setOverview).catch(() => setOverview(null))
  }, [contextId])

  useEffect(() => {
    if (!contextId || !canSeeMembers) return
    api.listOrganizationMembers(contextId).then(setMembers).catch(() => setMembers([]))
  }, [contextId, canSeeMembers])

  useEffect(() => {
    if (!contextId || !canSeeActivity) return
    api.listOrganizationActivity(contextId, 10).then(setActivity).catch(() => setActivity([]))
  }, [contextId, canSeeActivity])

  const orgName =
    organizations.find((o) => o.id === contextId)?.name ??
    contextName ??
    overview?.organization.name ??
    t("org.dashboard.title")

  const align = isRTL ? "right" : "left"
  const rowDirection = isRTL ? "row-reverse" : "row"

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.c.bg }}
      contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[4] }}
    >
      <View>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: tokens.size["2xl"],
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: align,
          }}
        >
          {orgName}
        </Text>
        <Text style={{ fontSize: tokens.size.sm, color: tokens.c.muted, textAlign: align }}>
          {overview?.member_count ?? 0} {t("org.dashboard.members_count")} ·{" "}
          {overview?.device_count ?? 0} {t("org.dashboard.devices_count")} ·{" "}
          {overview?.open_incident_count ?? 0} {t("org.dashboard.incidents_count")}
        </Text>
      </View>

      <View style={{ flexDirection: rowDirection, flexWrap: "wrap", gap: tokens.space[3] }}>
        <Kpi label={t("org.dashboard.members")} value={overview?.member_count ?? 0} />
        <Kpi label={t("org.dashboard.devices")} value={overview?.device_count ?? 0} />
        <Kpi label={t("org.dashboard.incidents")} value={overview?.open_incident_count ?? 0} />
        <Kpi label={t("org.dashboard.score")} value={overview?.security_score ?? 0} />
      </View>

      {canSeeTables && (
        <Card title={t("org.dashboard.recent_devices")}>
          {(overview?.recent_devices ?? []).length === 0 ? (
            <Empty />
          ) : (
            (overview?.recent_devices ?? []).map((d) => (
              <Row
                key={d.id}
                title={d.name || "—"}
                meta={`${d.os} · ${d.type}`}
                time={d.last_seen}
              />
            ))
          )}
        </Card>
      )}

      {canSeeTables && (
        <Card title={t("org.dashboard.recent_incidents")}>
          {(overview?.recent_incidents ?? []).length === 0 ? (
            <Empty />
          ) : (
            (overview?.recent_incidents ?? []).map((i) => (
              <Row
                key={i.id}
                title={`${i.title}`}
                meta={`${i.severity} · ${i.status}`}
                time={i.created_at}
              />
            ))
          )}
        </Card>
      )}

      {canSeeMembers && (
        <OrgMembersCard
          orgId={contextId ?? ""}
          role={role}
          members={members}
          onChanged={() => {
            if (!contextId) return
            api.listOrganizationMembers(contextId).then(setMembers).catch(() => setMembers([]))
            api.getOrganizationOverview(contextId).then(setOverview).catch(() => undefined)
          }}
        />
      )}

      {canSeeActivity && (
        <Card title={t("org.dashboard.recent_activity")}>
          {activity.length === 0 ? (
            <Text style={{ color: tokens.c.muted, textAlign: align }}>
              {t("org.activity.empty")}
            </Text>
          ) : (
            activity.map((a, idx) => (
              <Row
                key={`${a.type}-${idx}`}
                title={`${t(`org.activity.${a.type}`)}: ${a.title}`}
                meta={a.actor_email ?? ""}
                time={a.created_at}
              />
            ))
          )}
        </Card>
      )}
    </ScrollView>
  )
}

function Kpi({ label, value }: { label: string; value: number }) {
  const tokens = useTokens()
  return (
    <View
      style={{
        width: "48%",
        backgroundColor: tokens.c.surface,
        borderColor: tokens.c.border,
        borderWidth: 1,
        borderRadius: tokens.radius.md,
        padding: tokens.space[4],
      }}
    >
      <Text style={{ fontSize: tokens.size["2xl"], fontWeight: "700", color: tokens.c.textStrong }}>
        {value}
      </Text>
      <Text style={{ fontSize: tokens.size.xs, color: tokens.c.muted }}>{label}</Text>
    </View>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const tokens = useTokens()
  const { isRTL } = useLocale()
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
      <Text
        style={{
          fontSize: tokens.size.md,
          fontWeight: "700",
          color: tokens.c.textStrong,
          textAlign: isRTL ? "right" : "left",
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

function Row({
  title,
  meta,
  time,
}: {
  title: string
  meta: string
  time?: string | null
}) {
  const tokens = useTokens()
  const { isRTL } = useLocale()
  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: tokens.space[2],
      }}
    >
      <View style={{ flexShrink: 1 }}>
        <Text style={{ color: tokens.c.text, textAlign: isRTL ? "right" : "left" }}>{title}</Text>
        {!!meta && (
          <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{meta}</Text>
        )}
      </View>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>
        {time ? new Date(time).toLocaleDateString() : "—"}
      </Text>
    </View>
  )
}

function Empty() {
  const tokens = useTokens()
  return <Text style={{ color: tokens.c.muted }}>—</Text>
}
