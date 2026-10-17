import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// The vault components live one level up from this __tests__ directory.
const vaultDir = join(dirname(fileURLToPath(import.meta.url)), "..")
const sourceFiles = readdirSync(vaultDir).filter((f) => /\.(ts|tsx)$/.test(f))

function linesMatching(file: string, pattern: RegExp): string[] {
  const content = readFileSync(join(vaultDir, file), "utf8")
  return content.split("\n").filter((line) => pattern.test(line))
}

describe("password vault security checks", () => {
  it("scans the vault component sources", () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
  })

  it("no component logs secret material", () => {
    const unsafe: string[] = []
    for (const file of sourceFiles) {
      for (const line of linesMatching(file, /console\.(log|debug|info)/)) {
        if (/password|secret|totp|master/.test(line.toLowerCase())) {
          unsafe.push(`${file}: ${line.trim()}`)
        }
      }
    }
    expect(unsafe).toEqual([])
  })

  it("no component writes secrets to web storage", () => {
    const unsafe: string[] = []
    for (const file of sourceFiles) {
      for (const line of linesMatching(file, /(localStorage|sessionStorage)/)) {
        if (/password|secret|totp|master/.test(line.toLowerCase())) {
          unsafe.push(`${file}: ${line.trim()}`)
        }
      }
    }
    expect(unsafe).toEqual([])
  })
})
