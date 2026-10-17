import { describe, expect, it } from "vitest"

describe("Vault security", () => {
  it("no component calls console.log with secret keywords", () => {
    // We'll inspect the component source files and verify there are no dangerous log statements.
    // We'll read the files and assert they don't contain "console.log" followed by secret keywords.
    const fs = require("fs")
    const path = require("path")
    const vaultDir = path.resolve(__dirname, "../")
    const files = fs.readdirSync(vaultDir).filter((f: string) => f.endsWith(".tsx") || f.endsWith(".ts"))
    for (const file of files) {
      const content = fs.readFileSync(path.join(vaultDir, file), "utf8")
      const logMatches = content.match(/console\.(log|debug|info)/g) || []
      for (const match of logMatches) {
        const line = content.split("\n").filter((l: string) => l.includes(match))[0] || ""
        expect(line.toLowerCase()).not.toMatch(/password|secret|totp|master/)
      }
    }
    expect(true).toBe(true)
  })

  it("no component writes secrets to localStorage or sessionStorage", () => {
    const fs = require("fs")
    const path = require("path")
    const vaultDir = path.resolve(__dirname, "../")
    const files = fs.readdirSync(vaultDir).filter((f: string) => f.endsWith(".tsx") || f.endsWith(".ts"))
    for (const file of files) {
      const content = fs.readFileSync(path.join(vaultDir, file), "utf8")
      const storageMatches = content.match(/localStorage|sessionStorage/g) || []
      for (const match of storageMatches) {
        const line = content.split("\n").filter((l: string) => l.includes(match))[0] || ""
        expect(line.toLowerCase()).not.toMatch(/password|secret|totp|master/)
      }
    }
    expect(true).toBe(true)
  })
})
