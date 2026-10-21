import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { OrgActivityFeed } from "../OrgActivityFeed"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("OrgActivityFeed", () => {
  it("renders the merged, typed activity rows", () => {
    const activity = [
      {
        type: "incident_created" as const,
        title: "Suspicious login",
        severity: "high",
        actor_email: "a@x.com",
        created_at: new Date().toISOString(),
      },
    ]
    render(<OrgActivityFeed activity={activity} />)
    expect(screen.getByText(/Suspicious login/)).toBeTruthy()
    expect(screen.getByText("a@x.com")).toBeTruthy()
  })

  it("renders the empty state", () => {
    render(<OrgActivityFeed activity={[]} />)
    expect(screen.getByText("org.activity.empty")).toBeTruthy()
  })
})
