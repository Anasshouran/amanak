import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrgAuditFilters } from "../OrgAuditFilters"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("OrgAuditFilters", () => {
  it("action filter calls API", () => {
    const onActionChange = vi.fn()
    render(<OrgAuditFilters action="" actor="" onActionChange={onActionChange} onActorChange={vi.fn()} />)
    const select = screen.getByRole("combobox")
    fireEvent.change(select, { target: { value: "member.removed" } })
    expect(onActionChange).toHaveBeenCalledWith("member.removed")
  })

  it("actor search calls API", () => {
    const onActorChange = vi.fn()
    render(<OrgAuditFilters action="" actor="" onActionChange={vi.fn()} onActorChange={onActorChange} />)
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "a@x.com" } })
    expect(onActorChange).toHaveBeenCalledWith("a@x.com")
  })
})
